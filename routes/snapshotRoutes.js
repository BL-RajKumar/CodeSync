import express from 'express';
import {
  createSnapshot,
  getSnapshotsForFile,
  getSnapshot,
  restoreSnapshot,
  compareSnapshots,
  getBranchesForFile,
  createBranch,
  addTagToSnapshot
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

router.route('/file/:fileId/branches')
  .get(getBranchesForFile);

router.route('/:id/branch')
  .post(createBranch);

router.route('/:id/tag')
  .put(addTagToSnapshot);

export default router;
