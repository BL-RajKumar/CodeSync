import User from '../models/User.js';
import CollaborationSession from '../models/CollaborationSession.js';
import Project from '../models/Project.js';
import File from '../models/File.js';
import ExecutionHistory from '../models/ExecutionHistory.js';
import Language from '../models/Language.js';
import { activeExecutions, refreshLanguagesCache } from './sandboxController.js';

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

// Helper to fill in dates for the last 7 days
const getTimelineData = async (Model, matchField = 'createdAt') => {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const counts = await Model.aggregate([
    { $match: { [matchField]: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: `$${matchField}` } },
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = new Map(counts.map(item => [item._id, item.count]));
  return dates.map(date => ({
    date,
    count: countMap.get(date) || 0
  }));
};

// @desc    Get platform metrics and analytics dashboard data
// @route   GET /api/admin/analytics
// @access  Private/Admin
export const getPlatformAnalytics = async (req, res) => {
  try {
    // 1. Basic Stats Counts
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalProjects,
      publicProjects,
      privateProjects,
      totalFiles,
      totalSessions,
      activeSessions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Project.countDocuments(),
      Project.countDocuments({ visibility: 'Public' }),
      Project.countDocuments({ visibility: 'Private' }),
      File.countDocuments(),
      CollaborationSession.countDocuments(),
      CollaborationSession.countDocuments({ status: 'Active' }),
    ]);

    // 2. Execution History Stats
    const totalExecutions = await ExecutionHistory.countDocuments();
    const successfulExecutions = await ExecutionHistory.countDocuments({ status: 'Accepted' });

    // Average execution time aggregation
    const avgTimeRes = await ExecutionHistory.aggregate([
      { $match: { executionTimeMs: { $ne: null } } },
      { $group: { _id: null, avgTime: { $avg: '$executionTimeMs' } } }
    ]);
    const averageExecutionTime = avgTimeRes[0] ? Math.round(avgTimeRes[0].avgTime) : 0;

    // Language breakdown aggregation
    const languageBreakdown = await ExecutionHistory.aggregate([
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Status breakdown aggregation
    const statusBreakdown = await ExecutionHistory.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 3. 7-Day Growth Timelines
    const [userTimeline, projectTimeline, executionTimeline] = await Promise.all([
      getTimelineData(User),
      getTimelineData(Project),
      getTimelineData(ExecutionHistory),
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        timeline: userTimeline,
      },
      projects: {
        total: totalProjects,
        public: publicProjects,
        private: privateProjects,
        timeline: projectTimeline,
      },
      files: {
        total: totalFiles,
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
      },
      executions: {
        total: totalExecutions,
        successful: successfulExecutions,
        averageTimeMs: averageExecutionTime,
        successRate: totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0,
        languages: languageBreakdown.map(l => ({ language: l._id, count: l.count })),
        statuses: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
        timeline: executionTimeline,
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all languages (including inactive)
// @route   GET /api/admin/languages
// @access  Private/Admin
export const getLanguages = async (req, res) => {
  try {
    const langs = await Language.find().sort({ name: 1 });
    res.json(langs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new language configuration
// @route   POST /api/admin/languages
// @access  Private/Admin
export const createLanguage = async (req, res) => {
  const { id, name, displayName, version, category, extensions, aliases, color, description, isActive } = req.body;

  try {
    if (!id || !name || !displayName) {
      return res.status(400).json({ message: 'id, name, and displayName are required fields.' });
    }

    const nameLower = name.toLowerCase().trim();
    const existing = await Language.findOne({ $or: [{ id }, { name: nameLower }] });
    if (existing) {
      return res.status(400).json({ message: 'A language with this Judge0 ID or Name already exists.' });
    }

    const newLang = await Language.create({
      id,
      name: nameLower,
      displayName,
      version,
      category,
      extensions,
      aliases,
      color,
      description,
      isActive: isActive !== undefined ? isActive : true,
    });

    // Refresh sandbox cache
    await refreshLanguagesCache();

    res.status(201).json(newLang);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a language configuration
// @route   PUT /api/admin/languages/:id
// @access  Private/Admin
export const updateLanguage = async (req, res) => {
  const { id } = req.params;
  const { id: judge0Id, name, displayName, version, category, extensions, aliases, color, description, isActive } = req.body;

  try {
    const lang = await Language.findById(id);
    if (!lang) {
      return res.status(404).json({ message: 'Language configuration not found.' });
    }

    // Check uniqueness if Name or Judge0 ID is changing
    if (judge0Id && judge0Id !== lang.id) {
      const existingId = await Language.findOne({ id: judge0Id });
      if (existingId) return res.status(400).json({ message: 'Another language already uses this Judge0 ID.' });
      lang.id = judge0Id;
    }

    if (name && name.toLowerCase().trim() !== lang.name) {
      const nameLower = name.toLowerCase().trim();
      const existingName = await Language.findOne({ name: nameLower });
      if (existingName) return res.status(400).json({ message: 'Another language already uses this name.' });
      lang.name = nameLower;
    }

    if (displayName !== undefined) lang.displayName = displayName;
    if (version !== undefined) lang.version = version;
    if (category !== undefined) lang.category = category;
    if (extensions !== undefined) lang.extensions = extensions;
    if (aliases !== undefined) lang.aliases = aliases;
    if (color !== undefined) lang.color = color;
    if (description !== undefined) lang.description = description;
    if (isActive !== undefined) lang.isActive = isActive;

    const updated = await lang.save();

    // Refresh sandbox cache
    await refreshLanguagesCache();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a language configuration
// @route   DELETE /api/admin/languages/:id
// @access  Private/Admin
export const deleteLanguage = async (req, res) => {
  const { id } = req.params;

  try {
    const lang = await Language.findById(id);
    if (!lang) {
      return res.status(404).json({ message: 'Language configuration not found.' });
    }

    // Prevent deletion of plaintext fallback to preserve stability
    if (lang.name === 'plaintext') {
      return res.status(400).json({ message: 'Cannot delete the fallback "plaintext" language configuration.' });
    }

    await Language.findByIdAndDelete(id);

    // Refresh sandbox cache
    await refreshLanguagesCache();

    res.json({ message: `Language configuration "${lang.displayName}" deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Broadcast a platform-wide message to all connected clients
// @route   POST /api/admin/broadcast
// @access  Private/Admin
export const sendBroadcast = async (req, res) => {
  const { title, message, type } = req.body;

  if (!title || !message || !type) {
    return res.status(400).json({ message: 'Title, message, and type are required' });
  }

  const validTypes = ['info', 'warning', 'critical'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ message: 'Invalid notification type' });
  }

  try {
    const io = req.app.get('io');
    
    if (io) {
      console.log(`[Admin] Emitting broadcast: ${title} (${type})`);
      io.emit('admin_broadcast', {
        title: title.trim(),
        message: message.trim(),
        type,
        timestamp: new Date()
      });
      res.status(200).json({ success: true, message: 'Broadcast transmitted successfully' });
    } else {
      console.error('[Admin] Socket.io instance not initialized on req.app');
      res.status(500).json({ message: 'Socket.io instance not initialized' });
    }
  } catch (error) {
    console.error('[Admin] Broadcast error:', error);
    res.status(500).json({ message: error.message });
  }
};
