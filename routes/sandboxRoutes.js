import express from 'express';
import { runCode, getSupportedLanguages } from '../controllers/sandboxController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/sandbox/run — execute code in sandbox
router.post('/run', protect, runCode);

// GET /api/sandbox/languages — list supported languages
router.get('/languages', protect, getSupportedLanguages);

export default router;
