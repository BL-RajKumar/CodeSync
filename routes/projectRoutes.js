import express from 'express';
import { createProject, getDeveloperProjects, getPublicProjects } from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for fetching projects
router.get('/public', getPublicProjects);

// Route is protected, meaning req.user will be populated
router.route('/')
  .post(protect, createProject)
  .get(protect, getDeveloperProjects);

export default router;
