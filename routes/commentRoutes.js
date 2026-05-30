import express from 'express';
import {
  addComment,
  updateComment,
  deleteComment,
  toggleResolve,
  getFileComments,
  getProjectComments,
} from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


// All routes require auth
router.use(protect);

router.route('/').post(addComment);

router.route('/file/:fileId').get(getFileComments);

router.route('/project/:projectId').get(getProjectComments);

router.route('/:id').put(updateComment).delete(deleteComment);

router.route('/:id/resolve').put(toggleResolve);

export default router;
