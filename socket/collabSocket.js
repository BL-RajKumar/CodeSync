import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import File from '../models/File.js';
import CollaborationSession from '../models/CollaborationSession.js';

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
  // Authenticate socket connections via JWT cookie or auth token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.cookie?.match(/jwt=([^;]+)/)?.[1];

      if (!token) {
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
          await session.save();
        }

        // Assign a cursor color based on participant index
        const participantIndex = session.participants.findIndex(
          p => p.userId.toString() === socket.user._id.toString()
        );
        const cursorColor = CURSOR_COLORS[participantIndex % CURSOR_COLORS.length];

        // Send session data to the joining user
        socket.emit('session-joined', {
          sessionId,
          fileContent: file.content,
          participants: session.participants,
          cursorColor,
          ownerId: session.ownerId,
          language: session.language,
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
    socket.on('code-change', async ({ sessionId, changes }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      // Broadcast changes to all other users in the session
      socket.to(roomName).emit('code-change', {
        userId: socket.user._id,
        username: socket.user.username,
        changes,
      });
    });

    // ─── FULL CONTENT SYNC (for save operations) ──────
    socket.on('content-sync', async ({ sessionId, content }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      // Broadcast the full content to all others (used after save)
      socket.to(roomName).emit('content-sync', {
        userId: socket.user._id,
        content,
      });
    });

    // ─── CURSOR MOVE ───────────────────────────────────
    socket.on('cursor-move', ({ sessionId, position, selection }) => {
      if (!currentSessionId || currentSessionId !== sessionId) return;

      const roomName = `session:${currentSessionMongoId}`;

      socket.to(roomName).emit('cursor-move', {
        userId: socket.user._id,
        username: socket.user.username,
        position,
        selection: selection || null,
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
        await session.save();

        const roomName = `session:${currentSessionMongoId}`;

        // Notify the kicked user
        io.to(roomName).emit('participant-kicked', {
          kickedUserId: targetUserId,
          kickedUsername: kickedUser.username,
          message: `${kickedUser.username} was removed from the session by the host.`,
        });

        // Also broadcast user-left so UI updates for everyone
        io.to(roomName).emit('user-left', {
          userId: targetUserId,
          username: kickedUser.username,
        });

        console.log(`[Socket] ${socket.user.username} kicked ${kickedUser.username} from session ${sessionId}`);
      } catch (error) {
        console.error('[Socket] Kick participant error:', error.message);
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
