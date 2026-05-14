import File from '../models/File.js';
import Project from '../models/Project.js';

// Helper to check if user has access to edit project
const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return { error: 'Project not found', status: 404 };
  if (project.ownerId.toString() !== userId.toString()) {
    return { error: 'Not authorized to modify this project', status: 403 };
  }
  return { project, error: null };
};

// @desc    Get all files for a project
// @route   GET /api/files/:projectId
// @access  Private
export const getProjectFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists and user has read access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    if (project.visibility !== 'Public' && project.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this private project' });
    }

    // Fetch all non-deleted files
    const files = await File.find({ projectId, isDeleted: false })
      .populate('lastEditedBy', 'username avatarUrl')
      .sort({ path: 1 });
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new file
// @route   POST /api/files
// @access  Private
export const createFile = async (req, res) => {
  const { projectId, name, path, language, content } = req.body;

  if (!projectId || !name || !path) {
    return res.status(400).json({ message: 'projectId, name, and path are required' });
  }

  try {
    const access = await checkProjectAccess(projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    // Check if file already exists
    const existingFile = await File.findOne({ projectId, path, isDeleted: false });
    if (existingFile) {
      return res.status(400).json({ message: 'A file already exists at this path' });
    }

    const file = await File.create({
      projectId,
      name,
      path,
      language: language || 'plaintext',
      content: content || '',
      size: content ? Buffer.byteLength(content, 'utf8') : 0,
      createdById: req.user._id,
      lastEditedBy: req.user._id,
    });

    const populatedFile = await file.populate('lastEditedBy', 'username avatarUrl');
    res.status(201).json(populatedFile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rename a file
// @route   PUT /api/files/:fileId/rename
// @access  Private
export const renameFile = async (req, res) => {
  const { name, path } = req.body;

  if (!name || !path) {
    return res.status(400).json({ message: 'name and path are required' });
  }

  try {
    const file = await File.findById(req.params.fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({ message: 'File not found' });
    }

    const access = await checkProjectAccess(file.projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    // Check if new path conflicts
    if (file.path !== path) {
      const existingFile = await File.findOne({ projectId: file.projectId, path, isDeleted: false });
      if (existingFile) {
        return res.status(400).json({ message: 'A file already exists at the new path' });
      }
    }

    file.name = name;
    file.path = path;
    file.lastEditedBy = req.user._id;

    await file.save();

    const populatedFile = await file.populate('lastEditedBy', 'username avatarUrl');
    res.json(populatedFile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a file (soft delete)
// @route   DELETE /api/files/:fileId
// @access  Private
export const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({ message: 'File not found' });
    }

    const access = await checkProjectAccess(file.projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    file.isDeleted = true;
    file.lastEditedBy = req.user._id;
    await file.save();

    res.json({ message: 'File deleted successfully', fileId: file._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a file's content
// @route   PUT /api/files/:fileId/content
// @access  Private
export const updateFileContent = async (req, res) => {
  const { content } = req.body;

  try {
    const file = await File.findById(req.params.fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({ message: 'File not found' });
    }

    const access = await checkProjectAccess(file.projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    file.content = content || '';
    file.size = content ? Buffer.byteLength(content, 'utf8') : 0;
    file.lastEditedBy = req.user._id;

    await file.save();

    res.json({ message: 'File saved successfully', fileId: file._id, size: file.size });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
