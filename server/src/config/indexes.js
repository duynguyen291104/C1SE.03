const mongoose = require('mongoose');

// Function to create all necessary indexes
const createIndexes = async () => {
  try {
    console.log('📑 Creating database indexes...');

    // User indexes
    await mongoose.connection.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.collection('users').createIndex({ roles: 1 });
    await mongoose.connection.collection('users').createIndex({ teacherStatus: 1 });
    console.log('✅ User indexes created');

    // RefreshToken indexes
    await mongoose.connection.collection('refreshtokens').createIndex({ tokenHash: 1 }, { unique: true });
    await mongoose.connection.collection('refreshtokens').createIndex({ userId: 1 });
    await mongoose.connection.collection('refreshtokens').createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 } // TTL index - auto delete expired tokens
    );
    console.log('✅ RefreshToken indexes created');

    // BannedWord indexes
    await mongoose.connection.collection('bannedwords').createIndex({ word: 1 }, { unique: true });
    await mongoose.connection.collection('bannedwords').createIndex({ enabled: 1 });
    console.log('✅ BannedWord indexes created');

    // AuditLog indexes
    await mongoose.connection.collection('auditlogs').createIndex({ userId: 1, createdAt: -1 });
    await mongoose.connection.collection('auditlogs').createIndex({ action: 1, createdAt: -1 });
    await mongoose.connection.collection('auditlogs').createIndex({ createdAt: -1 });
    console.log('✅ AuditLog indexes created');

    console.log('✅ All indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
  }
};

module.exports = createIndexes;
