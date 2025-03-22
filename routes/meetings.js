const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});
const upload = multer({ storage });

// Create uploads folder if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Create a new meeting with image upload
router.post('/', authMiddleware, upload.single('bannerImage'), async (req, res) => {
  const { title, description, link, password, emails, status, dateTime, category, backgroundColor, reminder } = req.body;
  const bannerImage = req.file ? `/uploads/${req.file.filename}` : '';

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({ message: 'Title is required and must be at least 3 characters' });
  }
  if (!link || !/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(link)) {
    return res.status(400).json({ message: 'Valid meeting link (http/https) is required' });
  }
  if (!dateTime || isNaN(new Date(dateTime).getTime())) {
    return res.status(400).json({ message: 'Valid date/time is required' });
  }
  if (emails && (!Array.isArray(emails) || !emails.every(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))) {
    return res.status(400).json({ message: 'Emails must be a valid array of email addresses' });
  }
  if (reminder && (typeof reminder !== 'number' || reminder < 0)) {
    return res.status(400).json({ message: 'Reminder must be a positive number (minutes)' });
  }

  try {
    const newMeetingStart = new Date(dateTime);
    const newMeetingEnd = new Date(newMeetingStart.getTime() + 60 * 60 * 1000);

    const existingMeetings = await Meeting.find({ user: req.user });
    const hasConflict = existingMeetings.some(meeting => {
      const existingStart = new Date(meeting.dateTime);
      const existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      return (
        (newMeetingStart >= existingStart && newMeetingStart < existingEnd) ||
        (newMeetingEnd > existingStart && newMeetingEnd <= existingEnd) ||
        (newMeetingStart <= existingStart && newMeetingEnd >= existingEnd)
      );
    });

    if (hasConflict) {
      return res.status(400).json({ message: 'Time slot conflicts with an existing meeting' });
    }

    const meeting = new Meeting({
      title: title.trim(),
      description: description ? description.trim() : '',
      link: link.trim(),
      password: password || '',
      emails: emails || [],
      status: status || 'accepted',
      category: category || 'pending',
      dateTime,
      bannerImage,
      backgroundColor: backgroundColor || '#ffffff',
      reminder: reminder || null,
      user: req.user,
    });

    await meeting.save();
    await User.findByIdAndUpdate(req.user, { $push: { meetings: meeting._id } });

    res.status(201).json({ message: 'Meeting created successfully', meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all meetings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, page = 1, limit = 10, category } = req.query;
    const currentDate = new Date();

    let query = { user: req.user };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && ['upcoming', 'pending', 'canceled', 'past'].includes(category)) {
      if (category === 'upcoming') {
        query.dateTime = { $gt: currentDate };
        query.category = { $ne: 'canceled' };
      } else if (category === 'past') {
        query.dateTime = { $lte: currentDate };
        query.category = { $ne: 'canceled' };
      } else {
        query.category = category;
      }
    }

    const skip = (page - 1) * limit;
    const meetings = await Meeting.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ dateTime: 1 });

    const totalMeetings = await Meeting.countDocuments(query);

    res.json({
      meetings,
      total: totalMeetings,
      page: parseInt(page),
      pages: Math.ceil(totalMeetings / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Edit a meeting with image upload
router.put('/:id', authMiddleware, upload.single('bannerImage'), async (req, res) => {
  const { title, description, link, password, emails, status, dateTime, category, backgroundColor, reminder } = req.body;
  const meetingId = req.params.id;
  const bannerImage = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const meeting = await Meeting.findOne({ _id: meetingId, user: req.user });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or not authorized' });
    }

    if (title) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (link) meeting.link = link;
    if (password !== undefined) meeting.password = password;
    if (emails) meeting.emails = emails;
    if (status) meeting.status = status;
    if (dateTime) meeting.dateTime = dateTime;
    if (category) meeting.category = category;
    if (bannerImage !== undefined) meeting.bannerImage = bannerImage;
    if (backgroundColor !== undefined) meeting.backgroundColor = backgroundColor;
    if (reminder !== undefined) meeting.reminder = reminder;

    await meeting.save();
    res.json({ message: 'Meeting updated successfully', meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a meeting
router.delete('/:id', authMiddleware, async (req, res) => {
  const meetingId = req.params.id;

  try {
    const meeting = await Meeting.findOne({ _id: meetingId, user: req.user });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or not authorized' });
    }

    await Meeting.deleteOne({ _id: meetingId });
    await User.findByIdAndUpdate(req.user, { $pull: { meetings: meetingId } });

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Join a meeting
router.post('/join/:id', async (req, res) => {
  const { password, email } = req.body;
  const meetingId = req.params.id;

  if (!email) {
    return res.status(400).json({ message: 'Email is required to join' });
  }

  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (meeting.password && meeting.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    if (meeting.emails.includes(email)) {
      return res.status(400).json({ message: 'You are already a participant' });
    }

    if (!meeting.pendingParticipants.includes(email)) {
      meeting.pendingParticipants.push(email);
      await meeting.save();
    }

    res.json({ message: 'Join request sent, awaiting approval', meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve or reject join request
router.put('/approve/:id', authMiddleware, async (req, res) => {
  const { email, action } = req.body;
  const meetingId = req.params.id;

  if (!email || !action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Email and valid action (approve/reject) are required' });
  }

  try {
    const meeting = await Meeting.findOne({ _id: meetingId, user: req.user });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or not authorized' });
    }

    const participantIndex = meeting.pendingParticipants.indexOf(email);
    if (participantIndex === -1) {
      return res.status(400).json({ message: 'Participant not found in pending list' });
    }

    meeting.pendingParticipants.splice(participantIndex, 1);
    if (action === 'approve') {
      meeting.emails.push(email);
    }

    await meeting.save();
    res.json({ message: `Participant ${action}ed successfully`, meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle ignore status
router.put('/ignore/:id', authMiddleware, async (req, res) => {
  const meetingId = req.params.id;

  try {
    const meeting = await Meeting.findOne({ _id: meetingId, user: req.user });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or not authorized' });
    }

    meeting.status = meeting.status === 'ignore' ? 'accepted' : 'ignore';
    await meeting.save();

    res.json({ message: `Meeting ${meeting.status === 'ignore' ? 'ignored' : 'unignored'}`, meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;