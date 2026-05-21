import User from '../models/User.js';
import CollaborationSession from '../models/CollaborationSession.js';
import { activeExecutions } from './sandboxController.js';

// @desc    Get all users (with search and filters)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    
    // Construct query object
    const query = {};

    // Exclude the current admin themselves from the list to avoid self-suspension/deletion
    query._id = { $ne: req.user._id };

    // Search query matching username, email, or fullName
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { fullName: searchRegex }
      ];
    }

    // Role filter
    if (role && ['Guest', 'Developer', 'Admin'].includes(role)) {
      query.role = role;
    }

    // Status filter
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'suspended') {
        query.isActive = false;
      }
    }

    // Fetch users sorted by newest first, excluding passwordHash
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle user suspension status
// @route   PUT /api/admin/users/:id/suspend
// @access  Private/Admin
export const suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle active state
    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User status updated successfully. ${user.username} is now ${user.isActive ? 'Active' : 'Suspended'}.`,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Permanently delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: `User "${user.username}" has been permanently deleted.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all active collaboration sessions
// @route   GET /api/admin/sessions
// @access  Private/Admin
export const getActiveSessions = async (req, res) => {
  try {
    const sessions = await CollaborationSession.find({ status: 'Active' })
      .populate('projectId', 'name')
      .populate('fileId', 'name')
      .populate('ownerId', 'username email avatarUrl')
      .sort({ createdAt: -1 });

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Force terminate an active collaboration session
// @route   DELETE /api/admin/sessions/:sessionId
// @access  Private/Admin
export const terminateSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await CollaborationSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.status = 'Ended';
    session.endedAt = new Date();
    session.participants = [];
    await session.save();

    // Emit session-ended event and forcibly remove all sockets from the room
    const io = req.app.get('io');
    if (io) {
      const roomName = `session:${session._id}`;
      io.to(roomName).emit('session-ended', {
        sessionId,
        message: 'This collaboration session has been terminated by an administrator.',
      });
      
      // Force all sockets to leave the room
      io.in(roomName).socketsLeave(roomName);
    }

    res.json({ message: 'Collaboration session terminated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all active code execution jobs
// @route   GET /api/admin/jobs
// @access  Private/Admin
export const getActiveJobs = async (req, res) => {
  try {
    const jobs = [];
    for (const [id, entry] of activeExecutions.entries()) {
      jobs.push({
        executionId: entry.executionId,
        userId: entry.userId,
        username: entry.username,
        projectId: entry.projectId,
        fileId: entry.fileId,
        language: entry.language,
        startedAt: entry.startedAt,
      });
    }
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Force cancel a running code execution job
// @route   DELETE /api/admin/jobs/:id
// @access  Private/Admin
export const cancelJob = async (req, res) => {
  const { id } = req.params;

  try {
    const entry = activeExecutions.get(id);
    if (!entry) {
      return res.status(404).json({ message: 'Active job execution not found or already completed.' });
    }

    // Trigger AbortController
    entry.controller.abort();

    // Remove from registry
    activeExecutions.delete(id);

    res.json({ message: `Job execution "${id}" cancelled successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
