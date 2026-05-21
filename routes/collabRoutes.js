import express from 'express';
import { startSession, joinSession, verifySessionPassword, endSession, getSession, inviteUser } from '../controllers/collabController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/start', protect, startSession);
router.get('/join/:sessionId', optionalAuth, joinSession);
router.post('/join/:sessionId/verify', verifySessionPassword);
router.post('/:sessionId/end', protect, endSession);
router.get('/:sessionId', protect, getSession);
router.post('/:sessionId/invite', protect, inviteUser);

export default router;
