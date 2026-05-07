const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Service = require('../models/Service');
const Post = require('../models/Post');
const connectDB = require('../config/database');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany();
    await Listing.deleteMany();
    await Service.deleteMany();
    await Post.deleteMany();

    console.log('Seeding users...');
    const users = await User.create([
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@communex.com',
        rollNumber: 'ADMIN001',
        password: 'password123',
        isAdmin: true,
        department: 'Administration',
        isVerified: true,
        wallet: { balance: 1000 },
        tokens: { balance: 500 }
      },
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@student.com',
        rollNumber: 'CS2023001',
        password: 'password123',
        department: 'Computer Science',
        year: 3,
        isVerified: true,
        wallet: { balance: 500 },
        tokens: { balance: 100 }
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@student.com',
        rollNumber: 'EE2023005',
        password: 'password123',
        department: 'Electrical Engineering',
        year: 2,
        isVerified: true,
        wallet: { balance: 300 },
        tokens: { balance: 50 }
      }
    ]);

    const admin = users[0];
    const john = users[1];
    const jane = users[2];

    console.log('Seeding listings...');
    await Listing.create([
      {
        title: 'Calculus Textbook - 12th Edition',
        description: 'Hardcover, slightly used, no markings inside. Perfect for Engineering students.',
        category: 'books',
        price: 450,
        condition: 'good',
        seller: john._id,
        tags: ['textbook', 'calculus', 'math', 'engineering'],
        status: 'active'
      },
      {
        title: 'Dorm Desk Lamp',
        description: 'LED desk lamp with 3 brightness levels and USB charging port.',
        category: 'furniture',
        price: 200,
        condition: 'like-new',
        seller: jane._id,
        tags: ['lamp', 'dorm', 'furniture', 'electronics'],
        status: 'active'
      },
      {
        title: 'Scientific Calculator',
        description: 'Casio FX-991EX, essential for exams.',
        category: 'electronics',
        price: 1200,
        condition: 'new',
        seller: john._id,
        tags: ['calculator', 'math', 'casio'],
        status: 'active'
      }
    ]);

    console.log('Seeding services...');
    await Service.create([
      {
        title: 'Python Tutoring',
        description: 'Help with assignments, projects, and interview prep. 2 years experience.',
        category: 'tutoring',
        serviceType: 'offering',
        pricing: { type: 'hourly', amount: 300 },
        provider: john._id,
        tags: ['python', 'coding', 'tutoring', 'programming'],
        status: 'active'
      },
      {
        title: 'Resume Review',
        description: 'I will help you polish your resume for internships.',
        category: 'freelancing',
        serviceType: 'offering',
        pricing: { type: 'fixed', amount: 150 },
        provider: jane._id,
        tags: ['resume', 'internship', 'career', 'writing'],
        status: 'active'
      }
    ]);

    console.log('Seeding posts...');
    await Post.create([
      {
        title: 'Lost Keys near Library',
        content: 'Found a set of keys with a blue keychain near the main library entrance. Please contact if they are yours.',
        type: 'lost-found',
        author: jane._id,
        tags: ['lost', 'keys', 'library'],
        status: 'active'
      },
      {
        title: 'Best places to study late night?',
        content: 'Where is the quietest place on campus that stays open past midnight? Looking for recommendations.',
        type: 'discussion',
        author: john._id,
        tags: ['study', 'campus', 'midnight'],
        status: 'active'
      },
      {
        title: 'Upcoming Tech Symposium',
        content: 'Join us this Saturday for the annual Tech Symposium. Guest speakers from major tech companies!',
        type: 'announcement',
        author: admin._id,
        tags: ['event', 'tech', 'symposium'],
        status: 'active'
      }
    ]);

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
