/**
 * Script to approve a teacher in the database
 * Usage: node scripts/approve-teacher.js <email>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const approveTeacher = async (email) => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://admin:admin123@localhost:27017/edu_ecosystem?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    // Add teacher role if not exists
    if (!user.roles.includes('teacher')) {
      user.roles.push('teacher');
    }

    // Approve teacher
    user.teacherStatus = 'approved';
    await user.save();

    console.log(`✅ Teacher ${email} has been approved!`);
    console.log(`   Roles: ${user.roles.join(', ')}`);
    console.log(`   Status: ${user.teacherStatus}`);
    console.log(`   Name: ${user.profile.fullName}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/approve-teacher.js <email>');
  console.log('Example: node scripts/approve-teacher.js teacher@example.com');
  process.exit(1);
}

approveTeacher(email);
