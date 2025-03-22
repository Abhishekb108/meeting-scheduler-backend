const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const userRoutes = require('./routes/user');
const authMiddleware = require('./middleware/authMiddleware');
const path = require('path');

const app = express();

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('MongoDB connection error:', err));

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the uploads folder (for banner images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/user', userRoutes);

// Test protected route (optional, keeping it for debugging)
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'You are in a protected route!', userId: req.user });
});

// Root route
app.get('/', (req, res) => {
  res.send('Hello, your server is working!');
});

// Start the server
const PORT = process.env.PORT || 5000; // Fallback to 5000 if PORT not set
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});