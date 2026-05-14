import User from '../models/User.js';
import Project from '../models/Project.js';

// @desc    Search for users by username (Guest/Developer)
// @route   GET /api/users/search?q=...
// @access  Public
export const searchUsers = async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    // Case-insensitive regex search
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      isActive: true // only return active users
    }).select('username fullName avatarUrl role bio'); // don't return email or passwordHash

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's public profile by username
// @route   GET /api/users/:username
// @access  Public
export const getUserPublicProfile = async (req, res) => {
  const { username } = req.params;

  try {
    // Case-insensitive exact match for username
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') },
      isActive: true 
    }).select('username fullName avatarUrl role bio createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's public projects
// @route   GET /api/users/:username/projects
// @access  Public
export const getUserPublicProjects = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const projects = await Project.find({
      ownerId: user._id,
      visibility: 'Public'
    }).sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
