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

// POST /api/sandbox/run — execute code in sandbox
router.post('/run', protect, runCode);

// GET  /api/sandbox/languages — list supported languages
router.get('/languages', protect, getSupportedLanguages);

// GET  /api/sandbox/history — fetch execution history for current user
router.get('/history', protect, getHistory);

// DELETE /api/sandbox/history — clear all history for current user
router.delete('/history', protect, clearHistory);

// DELETE /api/sandbox/history/:id — delete single history entry
router.delete('/history/:id', protect, deleteHistoryEntry);

export default router;
