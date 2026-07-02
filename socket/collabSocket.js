import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import File from '../models/File.js';
import CollaborationSession from '../models/CollaborationSession.js';
import { createNotification } from '../utils/notificationService.js';

// Color palette for collaborator cursors
const CURSOR_COLORS = [
  '#f87171', // red
  '#34d399', // green
  '#60a5fa', // blue
  '#fbbf24', // yellow
  '#a78bfa', // purple
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f472b6', // pink
];

const initializeCollabSocket = (io) => {
  // Authenticate socket connections via JWT cookie, auth token, or Guest session ID
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.cookie?.match(/jwt=([^;]+)/)?.[1];

      if (!token) {
        // Authenticate guest user
        const guestUsername = socket.handshake.auth?.guestUsername;
        const guestUserId = socket.handshake.auth?.guestUserId;
        const sessionId = socket.handshake.auth?.sessionId;

        if (guestUsername && guestUserId && sessionId) {
          const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });
          if (session) {
            // Verify session password if applicable
            if (session.isPasswordProtected) {
              const sessionPassword = socket.handshake.auth?.sessionPassword;
              if (!sessionPassword || session.sessionPassword !== sessionPassword) {
                return next(new Error('Incorrect session password'));
              }
            }

            socket.user = {
              _id: guestUserId,
              username: guestUsername,
              isGuest: true
            };
            return next();
          }
        }
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.user.username} (${socket.id})`);

    // Join a personal user-targeted room for real-time notification alerts
    socket.join(`user:${socket.user._id.toString()}`);

    // Track which session this socket is in
    let currentSessionMongoId = null;
    let currentSessionId = null;

    // ─── JOIN SESSION ──────────────────────────────────
    socket.on('join-session', async ({ sessionId, password }) => {
      try {
        const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });

        if (!session) {
          socket.emit('error-message', { message: 'Session not found or has ended' });
          return;
        }

        // Block previously kicked users from rejoining
        const userId = socket.user._id.toString();
        if (session.kickedParticipants && session.kickedParticipants.includes(userId)) {
          socket.emit('error-message', { message: 'You have been removed from this session and cannot rejoin.' });
          return;
        }

        // Check password if protected
        if (session.isPasswordProtected) {
          if (!password || session.sessionPassword !== password) {
            socket.emit('error-message', { message: 'Incorrect session password' });
            return;
          }
        }

        // Check max participants
        if (session.participants.length >= session.maxParticipants) {
          const alreadyIn = session.participants.some(
            p => p.userId.toString() === socket.user._id.toString()
          );
          if (!alreadyIn) {
            socket.emit('error-message', { message: `Session is full (max ${session.maxParticipants} participants)` });
            return;
          }
        }

        // Get file content
        const file = await File.findById(session.fileId);
        if (!file || file.isDeleted) {
          socket.emit('error-message', { message: 'File no longer exists' });
          return;
        }

        // Join the socket room (use MongoDB _id for the room name)
        const roomName = `session:${session._id}`;
        socket.join(roomName);
        currentSessionMongoId = session._id.toString();
        currentSessionId = sessionId;

        // Add user to participants if not already present
        const alreadyParticipant = session.participants.some(
          p => p.userId.toString() === socket.user._id.toString()
        );

        if (!alreadyParticipant) {
          session.participants.push({
            userId: socket.user._id,
            username: socket.user.username,
            avatarUrl: socket.user.avatarUrl || '',
          });

          // Trigger participant join notification to the session owner
          if (session.ownerId.toString() !== socket.user._id.toString()) {
            await createNotification({
              recipientId: session.ownerId,
              actorId: socket.user._id,
              type: 'participant_join',
              title: 'Collaborator Joined',
              message: `${socket.user.username} has joined your active collaboration session on '${file.name}'.`,
              relatedId: session.sessionId,
              relatedType: 'CollaborationSession',
            });
          }
        }

        session.lastActiveAt = new Date();
        await session.save();

        // Assign a cursor color based on participant index
        const participantIndex = session.participants.findIndex(
          p => p.userId.toString() === socket.user._id.toString()
        );
        const cursorColor = CURSOR_COLORS[participantIndex % CURSOR_COLORS.length];

        // Send session data to the joining user
        socket.emit('session-joined', {
          sessionId,
          fileId: session.fileId,
          fileContent: file.content,
          participants: session.participants,
          cursorColor,
          ownerId: session.ownerId,
          language: session.language,
          createdAt: session.createdAt,
          isCopyPasteRestricted: session.isCopyPasteRestricted || false,
        });

        // Broadcast to others that a new user joined
        socket.to(roomName).emit('user-joined', {
          userId: socket.user._id,
          username: socket.user.username,
          avatarUrl: socket.user.avatarUrl || '',
          cursorColor,
        });

        console.log(`[Socket] ${socket.user.username} joined session ${sessionId}`);
      } catch (error) {
        console.error('[Socket] Join session error:', error.message);
        socket.emit('error-message', { message: 'Failed to join session' });
      }
    });

    // ─── CODE CHANGE ───────────────────────────────────
    socket.on('code-change', async ({ sessionId, fileId, changes }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      // Broadcast changes to all other users in the session
      socket.to(roomName).emit('code-change', {
        userId: socket.user._id,
        username: socket.user.username,
        fileId,
        changes,
      });
    });

    // ─── FULL CONTENT SYNC (for save operations) ──────
    socket.on('content-sync', async ({ sessionId, fileId, content }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      // Broadcast the full content to all others (used after save)
      socket.to(roomName).emit('content-sync', {
        userId: socket.user._id,
        fileId,
        content,
      });
    });

    // ─── CURSOR MOVE ───────────────────────────────────
    socket.on('cursor-move', ({ sessionId, fileId, position, selection }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      socket.to(roomName).emit('cursor-move', {
        userId: socket.user._id,
        username: socket.user.username,
        fileId,
        position,
        selection: selection || null,
      });
    });

    // ─── WHITEBOARD UPDATE ──────────────────────────────
    socket.on('whiteboard-update', ({ sessionId, elements, appState }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      socket.to(roomName).emit('whiteboard-update', {
        userId: socket.user._id,
        elements,
        appState
      });
    });

    // ─── KICK PARTICIPANT (owner only) ─────────────────
    socket.on('kick-participant', async ({ sessionId, targetUserId }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      try {
        const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });
        if (!session) return;

        // Only the session owner can kick
        if (session.ownerId.toString() !== socket.user._id.toString()) {
          socket.emit('error-message', { message: 'Only the session owner can kick participants' });
          return;
        }

        // Can't kick yourself
        if (targetUserId === socket.user._id.toString()) return;

        // Remove participant from DB
        const kickedUser = session.participants.find(
          p => p.userId.toString() === targetUserId
        );
        if (!kickedUser) return;

        session.participants = session.participants.filter(
          p => p.userId.toString() !== targetUserId
        );

        // Permanently ban this user from rejoining this session
        if (!session.kickedParticipants) session.kickedParticipants = [];
        if (!session.kickedParticipants.includes(targetUserId)) {
          session.kickedParticipants.push(targetUserId);
        }

        await session.save();

        const roomName = `session:${currentSessionMongoId}`;

        // Notify everyone (kicked user sees their own event)
        io.to(roomName).emit('participant-kicked', {
          kickedUserId: targetUserId,
          kickedUsername: kickedUser.username,
          message: `${kickedUser.username} was removed from the session by the host.`,
        });

        // Also broadcast user-left so participant list updates for everyone
        io.to(roomName).emit('user-left', {
          userId: targetUserId,
          username: kickedUser.username,
        });

        // Force-disconnect the kicked user's socket immediately
        try {
          const allSockets = await io.in(roomName).fetchSockets();
          for (const s of allSockets) {
            if (s.user && s.user._id.toString() === targetUserId) {
              s.leave(roomName);
              s.emit('force-disconnect', { reason: 'You have been removed from this session.' });
              s.disconnect(true);
            }
          }
        } catch (err) {
          console.error('[Socket] Force-disconnect error:', err.message);
        }

        console.log(`[Socket] ${socket.user.username} kicked ${kickedUser.username} from session ${sessionId}`);
      } catch (error) {
        console.error('[Socket] Kick participant error:', error.message);
      }
    });

    // ─── TOGGLE COPY PASTE RESTRICTION ─────────────────
    socket.on('toggle-copy-paste-restriction', async ({ sessionId, isCopyPasteRestricted }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      try {
        const session = await CollaborationSession.findOne({ sessionId, status: 'Active' });
        if (!session) return;

        // Verify this user is the owner/host
        if (session.ownerId.toString() !== socket.user._id.toString()) {
          socket.emit('error-message', { message: 'Only the session host can toggle copy-paste restriction.' });
          return;
        }

        session.isCopyPasteRestricted = isCopyPasteRestricted;
        await session.save();

        const roomName = `session:${currentSessionMongoId}`;
        io.to(roomName).emit('copy-paste-restriction-updated', {
          isCopyPasteRestricted
        });
        console.log(`[Socket] Host toggled copy-paste restriction in session ${sessionId} to ${isCopyPasteRestricted}`);
      } catch (error) {
        console.error('[Socket] Toggle copy-paste restriction error:', error.message);
      }
    });

    // ─── LEAVE SESSION ─────────────────────────────────
    socket.on('leave-session', async () => {
      if (!currentSessionMongoId) return;
      await handleLeaveSession(socket, currentSessionMongoId, currentSessionId);
      currentSessionMongoId = null;
      currentSessionId = null;
    });

    // ─── DISCONNECT ────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${socket.user.username} (${socket.id})`);
      if (currentSessionMongoId) {
        await handleLeaveSession(socket, currentSessionMongoId, currentSessionId);
      }
    });
  });

  // ─── Helper: Handle leaving a session ──────────────
  async function handleLeaveSession(socket, mongoId, sessionId) {
    try {
      const roomName = `session:${mongoId}`;

      // Remove participant from DB
      const session = await CollaborationSession.findById(mongoId);
      if (session) {
        session.participants = session.participants.filter(
          p => p.userId.toString() !== socket.user._id.toString()
        );
        session.lastActiveAt = new Date();
        await session.save();

        // Notify others
        socket.to(roomName).emit('user-left', {
          userId: socket.user._id,
          username: socket.user.username,
        });
      }

      socket.leave(roomName);
      console.log(`[Socket] ${socket.user.username} left session ${sessionId}`);
    } catch (error) {
      console.error('[Socket] Leave session error:', error.message);
    }
  }
};

export default initializeCollabSocket;
