const Redis = require('ioredis');

class RedisPresenceManager {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      family: 4, // Force IPv4
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('connect', () => {
      console.log('✅ Redis Presence Manager connected');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis Presence Manager error:', err);
    });
  }

  // ============ Room Presence ============

  /**
   * Add user to room
   */
  async addUserToRoom(roomId, userId, userData) {
    const pipeline = this.client.pipeline();
    
    // Add to room members set
    pipeline.sadd(`room:${roomId}:members`, userId);
    
    // Store user data in room
    pipeline.hset(`room:${roomId}:users`, userId, JSON.stringify(userData));
    
    // Set user's current room
    pipeline.set(`user:${userId}:room`, roomId, 'EX', 7200); // 2 hours TTL
    
    // Set room TTL to auto-cleanup
    pipeline.expire(`room:${roomId}:members`, 7200);
    pipeline.expire(`room:${roomId}:users`, 7200);
    
    await pipeline.exec();
  }

  /**
   * Remove user from room
   */
  async removeUserFromRoom(roomId, userId) {
    const pipeline = this.client.pipeline();
    
    pipeline.srem(`room:${roomId}:members`, userId);
    pipeline.hdel(`room:${roomId}:users`, userId);
    pipeline.del(`user:${userId}:room`);
    pipeline.hdel(`room:${roomId}:sockets`, userId);
    
    await pipeline.exec();
  }

  /**
   * Get all members in a room
   */
  async getRoomMembers(roomId) {
    const userIds = await this.client.smembers(`room:${roomId}:members`);
    if (!userIds || userIds.length === 0) return [];

    const usersData = await this.client.hmget(`room:${roomId}:users`, ...userIds);
    return usersData
      .filter(data => data)
      .map(data => JSON.parse(data));
  }

  /**
   * Get member count
   */
  async getRoomMemberCount(roomId) {
    return await this.client.scard(`room:${roomId}:members`);
  }

  /**
   * Check if user is in room
   */
  async isUserInRoom(roomId, userId) {
    return await this.client.sismember(`room:${roomId}:members`, userId);
  }

  // ============ Socket Mapping ============

  /**
   * Map socket to user in room
   */
  async setUserSocket(roomId, userId, socketId) {
    await this.client.hset(`room:${roomId}:sockets`, userId, socketId);
    await this.client.set(`socket:${socketId}:user`, userId, 'EX', 7200);
    await this.client.set(`socket:${socketId}:room`, roomId, 'EX', 7200);
  }

  /**
   * Get socket ID for user in room
   */
  async getUserSocket(roomId, userId) {
    return await this.client.hget(`room:${roomId}:sockets`, userId);
  }

  /**
   * Get user ID from socket
   */
  async getSocketUser(socketId) {
    return await this.client.get(`socket:${socketId}:user`);
  }

  /**
   * Get room ID from socket
   */
  async getSocketRoom(socketId) {
    return await this.client.get(`socket:${socketId}:room`);
  }

  /**
   * Remove socket mapping
   */
  async removeSocket(socketId) {
    const userId = await this.getSocketUser(socketId);
    const roomId = await this.getSocketRoom(socketId);

    if (roomId && userId) {
      await this.client.hdel(`room:${roomId}:sockets`, userId);
    }

    await this.client.del(`socket:${socketId}:user`);
    await this.client.del(`socket:${socketId}:room`);
  }

  // ============ Room Settings ============

  /**
   * Set room settings
   */
  async setRoomSettings(roomId, settings) {
    await this.client.set(
      `room:${roomId}:settings`,
      JSON.stringify(settings),
      'EX',
      7200
    );
  }

  /**
   * Get room settings
   */
  async getRoomSettings(roomId) {
    const data = await this.client.get(`room:${roomId}:settings`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update specific setting
   */
  async updateRoomSetting(roomId, key, value) {
    const settings = await this.getRoomSettings(roomId) || {};
    settings[key] = value;
    await this.setRoomSettings(roomId, settings);
    return settings;
  }

  // ============ Rate Limiting ============

  /**
   * Check and increment join attempts (for rate limiting)
   */
  async checkJoinRateLimit(ip, roomCode, maxAttempts = 5, windowSeconds = 60) {
    const key = `rl:join:${ip}:${roomCode}`;
    const attempts = await this.client.incr(key);
    
    if (attempts === 1) {
      await this.client.expire(key, windowSeconds);
    }

    return {
      attempts,
      remaining: Math.max(0, maxAttempts - attempts),
      limited: attempts > maxAttempts
    };
  }

  // ============ Media State (for WebRTC) ============

  /**
   * Set user's media state
   */
  async setUserMediaState(roomId, userId, mediaState) {
    await this.client.hset(
      `room:${roomId}:media`,
      userId,
      JSON.stringify(mediaState)
    );
  }

  /**
   * Get user's media state
   */
  async getUserMediaState(roomId, userId) {
    const data = await this.client.hget(`room:${roomId}:media`, userId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all media states in room
   */
  async getRoomMediaStates(roomId) {
    const data = await this.client.hgetall(`room:${roomId}:media`);
    const states = {};
    for (const [userId, stateJson] of Object.entries(data)) {
      states[userId] = JSON.parse(stateJson);
    }
    return states;
  }

  // ============ Cleanup ============

  /**
   * Clean up room completely
   */
  async cleanupRoom(roomId) {
    const pipeline = this.client.pipeline();
    
    pipeline.del(`room:${roomId}:members`);
    pipeline.del(`room:${roomId}:users`);
    pipeline.del(`room:${roomId}:sockets`);
    pipeline.del(`room:${roomId}:settings`);
    pipeline.del(`room:${roomId}:media`);
    
    await pipeline.exec();
  }

  /**
   * Get all active rooms
   */
  async getActiveRooms() {
    const keys = await this.client.keys('room:*:members');
    const roomIds = keys.map(key => key.split(':')[1]);
    
    const rooms = await Promise.all(
      roomIds.map(async (roomId) => {
        const count = await this.getRoomMemberCount(roomId);
        return { roomId, memberCount: count };
      })
    );
    
    return rooms.filter(r => r.memberCount > 0);
  }

  /**
   * Health check
   */
  async ping() {
    return await this.client.ping();
  }

  /**
   * Close connection
   */
  async disconnect() {
    await this.client.quit();
  }
}

// Singleton instance
let presenceManager = null;

const getPresenceManager = () => {
  if (!presenceManager) {
    presenceManager = new RedisPresenceManager();
  }
  return presenceManager;
};

module.exports = {
  RedisPresenceManager,
  getPresenceManager
};
