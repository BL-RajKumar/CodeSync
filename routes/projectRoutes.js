import express from 'express';
import { createProject, getDeveloperProjects, getPublicProjects, forkProject } from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for fetching projects
router.get('/public', getPublicProjects);

// Route is protected, meaning req.user will be populated
router.route('/')
  .post(protect, createProject)
  .get(protect, getDeveloperProjects);

// Fork a project
router.post('/:id/fork', protect, forkProject);

export default router;
