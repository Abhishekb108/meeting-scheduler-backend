const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Test bcrypt directly (temporary)
router.get('/test-bcrypt', async (req, res) => {
  try {
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Test hashed password:', hashedPassword);

    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log('Test bcrypt match result:', isMatch);

    res.json({ message: 'bcrypt test completed', isMatch });
  } catch (error) {
    console.log('bcrypt test error:', error);
    res.status(500).json({ message: 'bcrypt test failed', error: error.message });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ message: 'Username is required and must be at least 3 characters' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password is required and must be at least 6 characters' });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    console.log('Signup input password:', password);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.trim(),
      email: emailLower,
      password ,
    });

    await user.save();
    console.log('User created:', { username: user.username, email: user.email, hashedPassword: user.password });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (error) {
    console.log('Signup Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password is required and must be at least 6 characters' });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      console.log('User not found for email:', emailLower);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('Input password:', password);
    console.log('Stored hashed password:', user.password);
    const isMatch = await user.matchPassword(password );
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch for email:', emailLower);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('Login successful for email:', emailLower);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.log('Login Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;