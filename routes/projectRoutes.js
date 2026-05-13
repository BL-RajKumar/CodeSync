import express from 'express';
import { createProject, getDeveloperProjects } from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route is protected, meaning req.user will be populated
router.route('/')
  .post(protect, createProject)
  .get(protect, getDeveloperProjects);

export default router;
