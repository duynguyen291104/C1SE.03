const Minio = require('minio');
const fs = require('fs');
const path = require('path');

class MinioService {
  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'minio',
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minio_admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minio_password'
    });
    
    this.bucket = process.env.MINIO_BUCKET || 'edu-docs';
    this.initialized = false;
  }

  /**
   * Initialize MinIO - ensure bucket exists
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const exists = await this.client.bucketExists(this.bucket);
      
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        console.log(`✅ MinIO bucket created: ${this.bucket}`);
      } else {
        console.log(`✅ MinIO bucket exists: ${this.bucket}`);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('❌ MinIO initialization error:', error);
      throw error;
    }
  }

  /**
   * Upload file to MinIO
   * @param {string|Buffer|Stream} source - File path, buffer or stream
   * @param {string} objectKey - Object key in bucket
   * @param {string} contentType - MIME type
   * @returns {Promise<object>} Upload result
   */
  async uploadObject(source, objectKey, contentType) {
    await this.initialize();

    try {
      let result;
      
      if (typeof source === 'string') {
        // File path
        const stats = fs.statSync(source);
        result = await this.client.fPutObject(
          this.bucket,
          objectKey,
          source,
          { 'Content-Type': contentType }
        );
        result.size = stats.size;
      } else if (Buffer.isBuffer(source)) {
        // Buffer
        result = await this.client.putObject(
          this.bucket,
          objectKey,
          source,
          source.length,
          { 'Content-Type': contentType }
        );
        result.size = source.length;
      } else {
        // Stream
        result = await this.client.putObject(
          this.bucket,
          objectKey,
          source,
          { 'Content-Type': contentType }
        );
      }

      return {
        bucket: this.bucket,
        objectKey,
        etag: result.etag,
        versionId: result.versionId
      };
    } catch (error) {
      console.error('MinIO upload error:', error);
      throw new Error(`Failed to upload to MinIO: ${error.message}`);
    }
  }

  /**
   * Download object from MinIO to local file
   * @param {string} objectKey - Object key
   * @param {string} localPath - Local file path to save
   */
  async downloadObject(objectKey, localPath) {
    await this.initialize();

    try {
      await this.client.fGetObject(this.bucket, objectKey, localPath);
      return localPath;
    } catch (error) {
      console.error('MinIO download error:', error);
      throw new Error(`Failed to download from MinIO: ${error.message}`);
    }
  }

  /**
   * Get object as stream
   * @param {string} objectKey - Object key
   * @returns {Promise<Stream>} Object stream
   */
  async getObjectStream(objectKey) {
    await this.initialize();

    try {
      return await this.client.getObject(this.bucket, objectKey);
    } catch (error) {
      console.error('MinIO get stream error:', error);
      throw new Error(`Failed to get object stream: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for download
   * @param {string} objectKey - Object key
   * @param {number} expirySeconds - Expiry time in seconds (default 10 minutes)
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedUrl(objectKey, expirySeconds = 600) {
    await this.initialize();

    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        objectKey,
        expirySeconds
      );
      return url;
    } catch (error) {
      console.error('MinIO presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Delete object from MinIO
   * @param {string} objectKey - Object key to delete
   */
  async deleteObject(objectKey) {
    await this.initialize();

    try {
      await this.client.removeObject(this.bucket, objectKey);
      return true;
    } catch (error) {
      console.error('MinIO delete error:', error);
      throw new Error(`Failed to delete from MinIO: ${error.message}`);
    }
  }

  /**
   * Check if object exists
   * @param {string} objectKey - Object key
   * @returns {Promise<boolean>}
   */
  async objectExists(objectKey) {
    await this.initialize();

    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata
   * @param {string} objectKey - Object key
   * @returns {Promise<object>} Object stats
   */
  async getObjectInfo(objectKey) {
    await this.initialize();

    try {
      return await this.client.statObject(this.bucket, objectKey);
    } catch (error) {
      console.error('MinIO stat error:', error);
      throw new Error(`Failed to get object info: ${error.message}`);
    }
  }
}

// Singleton instance
const minioService = new MinioService();

module.exports = minioService;
