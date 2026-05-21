import express from 'express';
import { getAllUsers, suspendUser, deleteUser, getActiveSessions } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here require user login (protect) and Admin privileges (admin)
router.use(protect);
router.use(admin);

router.route('/users')
  .get(getAllUsers);

router.route('/users/:id/suspend')
  .put(suspendUser);

router.route('/users/:id')
  .delete(deleteUser);

router.route('/sessions')
  .get(getActiveSessions);

export default router;
