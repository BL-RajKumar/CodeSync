import express from 'express';
import { getProjectFiles, createFile, renameFile, deleteFile, updateFileContent, renameFolder, deleteFolder } from '../controllers/fileController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:projectId', optionalAuth, getProjectFiles);
router.post('/', protect, createFile);
router.put('/folder/rename', protect, renameFolder);
router.delete('/folder', protect, deleteFolder);
router.put('/:fileId/rename', protect, renameFile);
router.put('/:fileId/content', protect, updateFileContent);
router.delete('/:fileId', protect, deleteFile);

export default router;
