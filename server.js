import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';

import connectDB from './config/db.js';
import configurePassport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import collabRoutes from './routes/collabRoutes.js';
import sandboxRoutes from './routes/sandboxRoutes.js';
import snapshotRoutes from './routes/snapshotRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import initializeCollabSocket from './socket/collabSocket.js';

// Connect to database
// Note: Ensure MongoDB is running locally
connectDB();

const app = express();

// Create HTTP server explicitly so Socket.IO can attach to it
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});

// Store io on app so controllers can emit events
app.set('io', io);

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true // allow cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Required for passport twitter/github sometimes, and generally good practice for oauth state
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/comments', commentRoutes);

app.get('/', (req, res) => {
  res.send('CodeSync API is running...');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Initialize Socket.IO collaboration handlers
initializeCollabSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
});
