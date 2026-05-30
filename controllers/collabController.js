import CollaborationSession from '../models/CollaborationSession.js';
import Project from '../models/Project.js';
import File from '../models/File.js';
import User from '../models/User.js';
import { createNotification } from '../utils/notificationService.js';

// @desc    Start a new collaboration session on a file
// @route   POST /api/collab/start
// @access  Private (project owner only)
export const startSession = async (req, res) => {
  const { projectId, fileId, maxParticipants, isPasswordProtected, sessionPassword } = req.body;

  if (!projectId || !fileId) {
    return res.status(400).json({ message: 'projectId and fileId are required' });
  }

  try {
    // Verify project ownership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the project owner can start a collaboration session' });
    }

    // Verify file exists
    const file = await File.findById(fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({ message: 'File not found' });
    }
    if (file.projectId.toString() !== projectId) {
      return res.status(400).json({ message: 'File does not belong to this project' });
    }

    // Check if there's already an active session for this file
    const existingSession = await CollaborationSession.findOne({
      projectId,
      fileId,
      status: 'Active',
    });

    if (existingSession) {
      // Return the existing session instead of creating a new one
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.json({
        sessionId: existingSession.sessionId,
        shareLink: `${frontendUrl}/collab/${existingSession.sessionId}`,
        message: 'Active session already exists for this file',
      });
    }

    // Validate password if protection is enabled
    if (isPasswordProtected && (!sessionPassword || sessionPassword.trim().length === 0)) {
      return res.status(400).json({ message: 'Password is required when session is password protected' });
    }

    // Create a new session
    const session = await CollaborationSession.create({
      projectId,
      fileId,
      ownerId: req.user._id,
      language: file.language || 'plaintext',
      maxParticipants: maxParticipants || 5,
      isPasswordProtected: isPasswordProtected || false,
      sessionPassword: isPasswordProtected ? sessionPassword : '',
      initialFileContent: file.content,
      participants: [{
        userId: req.user._id,
        username: req.user.username,
        avatarUrl: req.user.avatarUrl || '',
      }],
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    res.status(201).json({
      sessionId: session.sessionId,
      shareLink: `${frontendUrl}/collab/${session.sessionId}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a collaboration session via sessionId
// @route   GET /api/collab/join/:sessionId
// @access  Public (optionalAuth)
export const joinSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });

    if (!session) {
      return res.status(404).json({ message: 'Session not found or has ended' });
    }

    res.json({
      sessionId: session.sessionId,
      projectId: session.projectId,
      fileId: session.fileId,
      ownerId: session.ownerId,
      language: session.language,
      maxParticipants: session.maxParticipants,
      isPasswordProtected: session.isPasswordProtected,
      currentParticipants: session.participants.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify session password
// @route   POST /api/collab/join/:sessionId/verify
// @access  Public
export const verifySessionPassword = async (req, res) => {
  const { sessionId } = req.params;
  const { password } = req.body;

  try {
    const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });

    if (!session) {
      return res.status(404).json({ message: 'Session not found or has ended' });
    }

    if (!session.isPasswordProtected) {
      return res.json({ verified: true });
    }

    if (session.sessionPassword === password) {
      return res.json({ verified: true });
    }

    return res.status(401).json({ message: 'Incorrect session password', verified: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    End a collaboration session
// @route   POST /api/collab/:sessionId/end
// @access  Private (owner only)
export const endSession = async (req, res) => {
  const { sessionId } = req.params;
  const { discardChanges } = req.body;

  try {
    const session = await CollaborationSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the session owner can end the session' });
    }

    session.status = 'Ended';
    session.endedAt = new Date();
    session.participants = [];
    await session.save();

    let revertedContent = undefined;

    // Handle discard changes
    if (discardChanges) {
      const file = await File.findById(session.fileId);
      if (file) {
        file.content = session.initialFileContent || '';
        await file.save();
        revertedContent = file.content;
      }
    }

    // Emit session-ended event and forcibly remove all sockets from the room
    const io = req.app.get('io');
    if (io) {
      const roomName = `session:${session._id}`;
      io.to(roomName).emit('session-ended', {
        sessionId,
        message: discardChanges 
          ? 'The host ended the session and discarded all changes.' 
          : 'The host has ended the collaboration session.',
        revertedContent
      });
      
      // Force all sockets to leave the room
      io.in(roomName).socketsLeave(roomName);
    }

    res.json({ message: 'Collaboration session ended', revertedContent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get session details
// @route   GET /api/collab/:sessionId
// @access  Private
export const getSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await CollaborationSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    res.json({
      ...session.toJSON(),
      shareLink: `${frontendUrl}/collab/${session.sessionId}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Invite a user to a collaboration session
// @route   POST /api/collab/:sessionId/invite
// @access  Private
export const inviteUser = async (req, res) => {
  const { sessionId } = req.params;
  // Fallback to 'username' for backward compatibility with old frontend code
  const targetIdentifier = req.body.target || req.body.username;

  if (!targetIdentifier) {
    return res.status(400).json({ message: 'Target username or email is required to send an invite' });
  }

  try {
    const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });
    if (!session) {
      return res.status(404).json({ message: 'Active session not found or has ended' });
    }

    // Verify req.user._id is the session owner
    if (session.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the session host can invite collaborators' });
    }

    // Find target user by username OR email (case-insensitive)
    const targetUser = await User.findOne({ 
      $or: [
        { username: { $regex: new RegExp(`^${targetIdentifier}$`, 'i') } },
        { email: { $regex: new RegExp(`^${targetIdentifier}$`, 'i') } }
      ]
    });
    
    if (!targetUser) {
      return res.status(404).json({ message: `User with username or email "${targetIdentifier}" not found` });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot invite yourself to your own session' });
    }

    // Fetch the file name for notification clarity
    const file = await File.findById(session.fileId);
    const fileName = file ? file.name : 'shared file';

    // Dispatch Session Invite notification!
    await createNotification({
      recipientId: targetUser._id,
      actorId: req.user._id,
      type: 'session_invite',
      title: 'Collaboration Invitation',
      message: `${req.user.username} invited you to join a live collaboration session on '${fileName}'.`,
      relatedId: session.sessionId,
      relatedType: 'CollaborationSession',
    });

    res.json({ message: `Collaboration invite sent to ${targetUser.username} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
