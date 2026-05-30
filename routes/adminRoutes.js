import express from 'express';
import { 
  getAllUsers, suspendUser, deleteUser, 
  getActiveSessions, terminateSession, 
  getActiveJobs, cancelJob, getPlatformAnalytics,
  getLanguages, createLanguage, updateLanguage, deleteLanguage,
  sendBroadcast
} from '../controllers/adminController.js';
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

router.route('/sessions/:sessionId')
  .delete(terminateSession);

router.route('/jobs')
  .get(getActiveJobs);

router.route('/jobs/:id')
  .delete(cancelJob);

router.route('/analytics')
  .get(getPlatformAnalytics);

router.route('/languages')
  .get(getLanguages)
  .post(createLanguage);

router.route('/languages/:id')
  .put(updateLanguage)
  .delete(deleteLanguage);

router.route('/broadcast')
  .post(sendBroadcast);

export default router;
