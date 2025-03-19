const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  link: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: false,
  },
  emails: [{
    type: String,
  }],
  pendingParticipants: [{
    type: String, // Emails awaiting approval
  }],
  status: {
    type: String,
    enum: ['accepted', 'rejected'],
    default: 'accepted',
  },
  category: {
    type: String,
    enum: ['upcoming', 'pending', 'canceled'],
    default: 'pending',
  },
  dateTime: {
    type: Date,
    required: true,
  },
  bannerImage: {
    type: String,
    required: false,
  },
  backgroundColor: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

meetingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Meeting = mongoose.model('Meeting', meetingSchema);
module.exports = Meeting;