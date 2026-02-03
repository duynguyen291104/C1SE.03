#!/bin/bash

echo "🔍 Checking student account in database..."
echo ""

# Check if mongosh is available
if ! command -v mongosh &> /dev/null; then
    echo "❌ mongosh not found. Installing..."
    # Use docker mongo client instead
    echo "Using Docker MongoDB client..."
    docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "
        const student = db.users.findOne({ email: 'student@edu.com' });
        if (student) {
            print('✅ Student account found:');
            print('   Email: ' + student.email);
            print('   Full Name: ' + (student.profile.fullName || 'N/A'));
            print('   Roles: ' + JSON.stringify(student.roles));
            print('   Active: ' + student.isActive);
            print('');
            print('⚠️  Password is hashed. Default should be: Student@123');
            print('   If login fails, create new student via Register page');
        } else {
            print('❌ Student account NOT found!');
            print('');
            print('Creating student account...');
            const bcrypt = require('bcryptjs');
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync('Student@123', salt);
            
            const newStudent = {
                email: 'student@edu.com',
                password: hashedPassword,
                roles: ['student'],
                teacherStatus: 'none',
                isActive: true,
                profile: {
                    fullName: 'Demo Student',
                    avatarUrl: '',
                    bio: ''
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            db.users.insertOne(newStudent);
            print('✅ Student account created successfully!');
            print('   Email: student@edu.com');
            print('   Password: Student@123');
        }
    "
else
    mongosh "mongodb://admin:admin123@localhost:27017/edu_ecosystem?authSource=admin" --eval "
        const student = db.users.findOne({ email: 'student@edu.com' });
        if (student) {
            print('✅ Student account found:');
            print('   Email: ' + student.email);
            print('   Full Name: ' + (student.profile.fullName || 'N/A'));
            print('   Roles: ' + JSON.stringify(student.roles));
            print('   Active: ' + student.isActive);
            print('');
            print('⚠️  Password is hashed. Default should be: Student@123');
            print('   If login fails, use Register page to create new student');
        } else {
            print('❌ Student account NOT found!');
            print('   Please create via Register page or ask admin');
        }
    "
fi

echo ""
echo "📋 All accounts:"
echo "   Teacher: teacher@edu.com / Teacher@123"
echo "   Admin: admin@edu.com / Admin@123"
echo "   Student: student@edu.com / Student@123 (or create new)"
echo ""
