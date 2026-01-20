const mongoose = require('mongoose');
const createIndexes = require('./indexes');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes
    await createIndexes();
    
    // Create demo users if not exists
    await createDemoUsers();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

const createDemoUsers = async () => {
  try {
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');

    // Demo users configuration
    const demoUsers = [
      {
        email: 'admin@edu.com',
        password: 'Admin@123',
        roles: ['admin'],
        teacherStatus: 'none',
        profile: {
          fullName: 'System Administrator',
          avatarUrl: ''
        }
      },
      {
        email: 'teacher@edu.com',
        password: 'Teacher@123',
        roles: ['teacher'],
        teacherStatus: 'approved',
        profile: {
          fullName: 'Nguyễn Văn Giáo Viên',
          avatarUrl: '',
          bio: 'Giáo viên dạy Toán và Lập trình'
        }
      },
      {
        email: 'teacher2@edu.com',
        password: 'Teacher@123',
        roles: ['teacher'],
        teacherStatus: 'approved',
        profile: {
          fullName: 'Trần Thị Minh',
          avatarUrl: '',
          bio: 'Giáo viên dạy Tiếng Anh'
        }
      },
      {
        email: 'student@edu.com',
        password: 'Student@123',
        roles: ['student'],
        teacherStatus: 'none',
        profile: {
          fullName: 'Lê Văn Học Sinh',
          avatarUrl: '',
          bio: 'Học sinh lớp 12A1'
        }
      },
      {
        email: 'student2@edu.com',
        password: 'Student@123',
        roles: ['student'],
        teacherStatus: 'none',
        profile: {
          fullName: 'Phạm Thị Lan',
          avatarUrl: '',
          bio: 'Học sinh lớp 11B2'
        }
      }
    ];

    for (const userData of demoUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        const user = await User.create({
          email: userData.email,
          passwordHash: hashedPassword,
          roles: userData.roles,
          teacherStatus: userData.teacherStatus,
          profile: userData.profile
        });

        console.log(`👤 Demo user created: ${user.email} (${userData.roles.join(', ')})`);
      }
    }
  } catch (error) {
    console.error('Error creating demo users:', error.message);
  }
};

module.exports = connectDB;
