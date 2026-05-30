import express from 'express';
import {
  runCode,
  getSupportedLanguages,
  getHistory,
  deleteHistoryEntry,
  clearHistory,
} from '../controllers/sandboxController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


router.post('/run', protect, runCode);

router.get('/languages', getSupportedLanguages);

router.get('/history', protect, getHistory);
router.delete('/history', protect, clearHistory);

router.delete('/history/:id', protect, deleteHistoryEntry);

export default router;
