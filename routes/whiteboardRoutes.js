import express from 'express';
import { getWhiteboard, updateWhiteboard } from '../controllers/whiteboardController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/:projectId')
  .get(optionalAuth, getWhiteboard)
  .post(protect, updateWhiteboard);

export default router;
