// meeting-scheduler-backend/routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Get user details
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user availability
router.put('/availability', authMiddleware, async (req, res) => {
  const { availability } = req.body;

  if (!availability || !Array.isArray(availability)) {
    return res.status(400).json({ message: 'Availability must be an array' });
  }

  try {
    const user = await User.findByIdAndUpdate(req.user, { availability }, { new: true });
    res.json({ message: 'Availability updated', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user settings (username, email, password)
router.put('/settings', authMiddleware, async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email && !password) {
    return res.status(400).json({ message: 'At least one field (username, email, or password) must be provided' });
  }

  try {
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let shouldLogout = false;

    if (username) user.username = username;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
      shouldLogout = true; // Logout required on email change
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      shouldLogout = true; // Logout required on password change
    }

    await user.save();
    res.json({ message: 'Settings updated successfully', user, shouldLogout });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route to update user preferences (username and category)
router.put('/preferences', authMiddleware, async (req, res) => {
  const { username, category } = req.body;

  // Validate input
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ message: 'Username is required and must be at least 3 characters' });
  }
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ message: 'Category is required' });
  }

  try {
    // Find the user by ID (from authMiddleware)
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields
    user.username = username.trim();
    user.category = category;

    // Save the updated user
    await user.save();

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.log('Error updating preferences:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;