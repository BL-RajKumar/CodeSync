import express from 'express';
import { searchUsers, getUserPublicProfile, getUserPublicProjects } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get('/search', protect, searchUsers);

router.get('/:username', getUserPublicProfile);

router.get('/:username/projects', getUserPublicProjects);

export default router;
