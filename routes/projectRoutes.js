import express from 'express';
import { createProject, getDeveloperProjects, getPublicProjects, forkProject, toggleStarProject, getStarredProjects } from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for fetching projects
router.get('/public', getPublicProjects);

// Route is protected, meaning req.user will be populated
router.route('/')
  .post(protect, createProject)
  .get(protect, getDeveloperProjects);

router.get('/starred', protect, getStarredProjects);

// Fork a project
router.post('/:id/fork', protect, forkProject);

// Star a project
router.post('/:id/star', protect, toggleStarProject);

export default router;
