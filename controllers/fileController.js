import File from '../models/File.js';
import Project from '../models/Project.js';
import CollaborationSession from '../models/CollaborationSession.js';

// Helper to check if user has access to edit project
const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return { error: 'Project not found', status: 404 };
  
  const isOwner = project.ownerId.toString() === userId.toString();
  if (isOwner) return { project, error: null };
  
  // Check if user is an active participant in a session for this project
  const session = await CollaborationSession.findOne({
    projectId,
    status: 'Active',
    "participants.userId": userId
  });
  if (session) {
    return { project, error: null };
  }

  return { error: 'Not authorized to modify this project', status: 403 };
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
    
    if (project.visibility !== 'Public') {
      const isOwner = req.user && project.ownerId.toString() === req.user._id.toString();
      let hasCollabAccess = false;

      if (!isOwner && req.user) {
        // Check if user is an active participant in a session for this project
        const session = await CollaborationSession.findOne({
          projectId: project._id,
          status: 'Active',
          "participants.userId": req.user._id
        });
        if (session) {
          hasCollabAccess = true;
        }
      }

      if (!isOwner && !hasCollabAccess && req.query.sessionId) {
        // Check by sessionId query param (for initial cold start before socket connects)
        const session = await CollaborationSession.findOne({
          sessionId: req.query.sessionId,
          projectId: project._id,
          status: 'Active'
        });
        if (session) {
          if (!session.isPasswordProtected) {
            hasCollabAccess = true;
          } else {
            const password = req.query.sessionPassword;
            if (password && session.sessionPassword === password) {
              hasCollabAccess = true;
            }
          }
        }
      }

      if (!isOwner && !hasCollabAccess) {
        return res.status(403).json({ message: 'Not authorized to view this private project' });
      }
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

// @desc    Rename or Move a folder
// @route   PUT /api/files/folder/rename
// @access  Private
export const renameFolder = async (req, res) => {
  const { projectId, oldPath, newPath } = req.body;

  if (!projectId || !oldPath || !newPath) {
    return res.status(400).json({ message: 'projectId, oldPath, and newPath are required' });
  }

  try {
    const access = await checkProjectAccess(projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    // Ensure we only match files EXACTLY in that folder (using trailing slash)
    // Escaping regex might be needed if paths have special chars, but paths usually don't.
    // To be safe, escape simple special chars if needed, but for file paths usually fine.
    const safeOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const files = await File.find({ 
      projectId, 
      path: { $regex: `^${safeOldPath}/` }, 
      isDeleted: false 
    });

    if (files.length === 0) {
      return res.status(404).json({ message: 'No files found in the specified folder' });
    }

    const updatedFiles = [];
    for (let file of files) {
      // Replace the leading folder path part
      file.path = file.path.replace(`${oldPath}/`, `${newPath}/`);
      file.lastEditedBy = req.user._id;
      await file.save();
      
      // We will need to re-populate the lastEditedBy to match standard response
      await file.populate('lastEditedBy', 'username avatarUrl');
      updatedFiles.push(file);
    }

    res.json({ message: 'Folder renamed successfully', files: updatedFiles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a folder
// @route   DELETE /api/files/folder
// @access  Private
export const deleteFolder = async (req, res) => {
  const { projectId, folderPath } = req.body;

  if (!projectId || !folderPath) {
    return res.status(400).json({ message: 'projectId and folderPath are required' });
  }

  try {
    const access = await checkProjectAccess(projectId, req.user._id);
    if (access.error) return res.status(access.status).json({ message: access.error });

    const safeFolderPath = folderPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const files = await File.find({ 
      projectId, 
      path: { $regex: `^${safeFolderPath}/` }, 
      isDeleted: false 
    });

    if (files.length === 0) {
      return res.status(404).json({ message: 'No files found in the specified folder' });
    }

    const deletedFileIds = [];
    for (let file of files) {
      file.isDeleted = true;
      file.lastEditedBy = req.user._id;
      await file.save();
      deletedFileIds.push(file._id);
    }

    res.json({ message: 'Folder deleted successfully', deletedFileIds });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search for text/code patterns across all files in a project
// @route   GET /api/files/:projectId/search?q=<query>
// @access  Private
export const searchInProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ message: 'Search query (q) is required' });
    }

    // Check if project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.visibility !== 'Public') {
      const isOwner = req.user && project.ownerId.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ message: 'Not authorized to search this project' });
      }
    }

    const searchTerm = q.trim();

    // Escape special regex characters so the search is a literal match
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find files whose content matches the search term
    const matchingFiles = await File.find({
      projectId,
      isDeleted: false,
      content: { $regex: escapedTerm, $options: 'i' }
    }).select('name path content language');

    // Extract matching lines from each file
    const results = [];
    let totalMatches = 0;

    for (const file of matchingFiles) {
      const lines = (file.content || '').split('\n');
      const matches = [];
      const regex = new RegExp(escapedTerm, 'gi');

      lines.forEach((lineContent, index) => {
        if (regex.test(lineContent)) {
          matches.push({
            line: index + 1,
            content: lineContent.trimEnd()
          });
          // Reset regex lastIndex since we use 'g' flag
          regex.lastIndex = 0;
        }
      });

      if (matches.length > 0) {
        totalMatches += matches.length;
        results.push({
          fileId: file._id,
          name: file.name,
          path: file.path,
          language: file.language,
          matches
        });
      }
    }

    // Sort results: most matches first
    results.sort((a, b) => b.matches.length - a.matches.length);

    res.json({
      query: searchTerm,
      totalMatches,
      fileCount: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
