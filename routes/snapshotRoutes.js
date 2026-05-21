import express from 'express';
import {
  createSnapshot,
  getSnapshotsForFile,
  getSnapshot,
  restoreSnapshot,
  compareSnapshots,
} from '../controllers/snapshotController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All snapshot routes require authentication
router.use(protect);

router.route('/')
  .post(createSnapshot);

router.route('/file/:fileId')
  .get(getSnapshotsForFile);

router.route('/:id')
  .get(getSnapshot);

router.route('/:id/restore')
  .post(restoreSnapshot);

router.route('/diff/:id1/:id2')
  .get(compareSnapshots);

export default router;
