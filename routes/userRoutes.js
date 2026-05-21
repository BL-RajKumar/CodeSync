import express from 'express';
import { searchUsers, getUserPublicProfile, getUserPublicProjects } from '../controllers/userController.js';

const router = express.Router();

router.get('/search', searchUsers);
router.get('/:username', getUserPublicProfile);
router.get('/:username/projects', getUserPublicProjects);

export default router;
