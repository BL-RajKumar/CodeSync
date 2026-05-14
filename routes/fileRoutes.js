import express from 'express';
import { getProjectFiles, createFile, renameFile, deleteFile, updateFileContent } from '../controllers/fileController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:projectId', protect, getProjectFiles);
router.post('/', protect, createFile);
router.put('/:fileId/rename', protect, renameFile);
router.put('/:fileId/content', protect, updateFileContent);
router.delete('/:fileId', protect, deleteFile);

export default router;
