import express from 'express';
import { createProject, getDeveloperProjects, getPublicProjects, updateProject, forkProject, toggleStarProject, getStarredProjects, getProjectById, deleteProject } from '../controllers/projectController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();


// Public route for fetching projects (optionalAuth so logged-in users' own projects are excluded)
router.get('/public', optionalAuth, getPublicProjects);

// Route is protected, meaning req.user will be populated
router.route('/')
  .post(protect, createProject)
  .get(protect, getDeveloperProjects);

router.get('/starred', protect, getStarredProjects);

// Get single project
router.get('/:id', optionalAuth, getProjectById);

router.post('/:id/fork', protect, forkProject);

router.post('/:id/star', protect, toggleStarProject);

router.delete('/:id', protect, deleteProject);
router.patch('/:id', protect, updateProject);

export default router;
