import Project from '../models/Project.js';
import User from '../models/User.js';
import CollaborationSession from '../models/CollaborationSession.js';
import File from '../models/File.js';
import Snapshot from '../models/Snapshot.js';
import Comment from '../models/Comment.js';
import { getBoilerplateForLanguage } from '../utils/boilerplateTemplates.js';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req, res) => {
  const { name, description, language, visibility, templateId } = req.body;

  if (!name || !language) {
    return res.status(400).json({ message: 'Project name and language are required' });
  }

  try {
    const project = await Project.create({
      name,
      description: description || '',
      language,
      visibility: visibility || 'Public',
      templateId: templateId || null,
      ownerId: req.user._id, // Set by the 'protect' middleware
    });

    const boilerplateFiles = getBoilerplateForLanguage(language);
    if (boilerplateFiles.length > 0) {
      const filesToInsert = boilerplateFiles.map(file => ({
        projectId: project._id,
        name: file.name,
        path: file.path,
        language,
        content: file.content,
        size: Buffer.byteLength(file.content, 'utf8'),
        createdById: req.user._id,
        lastEditedBy: req.user._id,
      }));
      await File.insertMany(filesToInsert);
    }

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all projects for the logged in developer
// @route   GET /api/projects
// @access  Private
export const getDeveloperProjects = async (req, res) => {
  try {
    const projects = await Project.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public projects with optional filters
// @route   GET /api/projects/public
// @access  Public (optionalAuth — excludes logged-in user's own projects)
export const getPublicProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    const { name, language, owner } = req.query;
    const query = { visibility: 'Public' };

    // Exclude the logged-in user's own projects from explore results
    if (req.user) {
      query.ownerId = { $ne: req.user._id };
    }

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    if (language) {
      query.language = { $regex: new RegExp(`^${language}$`, 'i') };
    }

    if (owner) {
      const users = await User.find({
        $or: [
          { username: { $regex: owner, $options: 'i' } },
          { fullName: { $regex: owner, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      // If ownerId filter already set (exclude self), intersect with owner search
      if (query.ownerId) {
        query.ownerId = { ...query.ownerId, $in: userIds };
      } else {
        query.ownerId = { $in: userIds };
      }
    }

    const totalProjects = await Project.countDocuments(query);
    const totalPages = Math.ceil(totalProjects / limit);

    const projects = await Project.find(query)
      .populate('ownerId', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      projects,
      currentPage: page,
      totalPages,
      totalProjects
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update project name / description
// @route   PATCH /api/projects/:id
// @access  Private (owner only)
export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this project' });
    }

    const { name, description } = req.body;

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ message: 'Project name cannot be empty' });
      project.name = trimmed;
    }

    if (description !== undefined) {
      project.description = description.trim();
    }

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fork a public project
// @route   POST /api/projects/:id/fork
// @access  Private
export const forkProject = async (req, res) => {
  try {
    const originalProject = await Project.findById(req.params.id);

    if (!originalProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (originalProject.visibility !== 'Public') {
      return res.status(403).json({ message: 'Cannot fork a private project' });
    }

    // Prevent forking own project
    if (originalProject.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot fork your own project' });
    }

    // Prevent multiple forks of the same project
    const existingFork = await Project.findOne({
      ownerId: req.user._id,
      forkedFrom: originalProject._id
    });

    if (existingFork) {
      return res.status(400).json({ message: 'You have already forked this project' });
    }

    // Increment fork count on the original project
    originalProject.forkCount += 1;
    await originalProject.save();

    // Create the forked project
    const forkedProject = await Project.create({
      name: `${originalProject.name} (Fork)`,
      description: originalProject.description,
      language: originalProject.language,
      visibility: 'Public', // Defaulting to public as planned
      templateId: originalProject.templateId,
      ownerId: req.user._id,
      forkedFrom: originalProject._id,
    });

    // Copy all non-deleted files from the original project into the fork
    const originalFiles = await File.find({
      projectId: originalProject._id,
      isDeleted: { $ne: true },
    });

    if (originalFiles.length > 0) {
      const copiedFiles = originalFiles.map(f => ({
        projectId: forkedProject._id,
        name: f.name,
        path: f.path,
        language: f.language,
        content: f.content,
        size: f.size,
        createdById: req.user._id,
        lastEditedBy: req.user._id,
      }));
      await File.insertMany(copiedFiles);
    }

    res.status(201).json(forkedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle star on a project
// @route   POST /api/projects/:id/star
// @access  Private
export const toggleStarProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    const user = await User.findById(req.user._id);

    if (!project || !user) {
      return res.status(404).json({ message: 'Project or User not found' });
    }

    const projectIdStr = project._id.toString();
    const isStarred = user.starredProjects.some(id => id.toString() === projectIdStr);

    if (isStarred) {
      // Unstar
      user.starredProjects = user.starredProjects.filter(id => id.toString() !== projectIdStr);
      project.starCount = Math.max(0, project.starCount - 1);
    } else {
      // Star
      user.starredProjects.push(project._id);
      project.starCount += 1;
    }

    await user.save();
    await project.save();

    res.json({
      message: isStarred ? 'Project unstarred' : 'Project starred',
      isStarred: !isStarred,
      starCount: project.starCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get starred projects for user
// @route   GET /api/projects/starred
// @access  Private
export const getStarredProjects = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const projects = await Project.find({ _id: { $in: user.starredProjects } })
      .populate('ownerId', 'username avatarUrl')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('ownerId', 'username avatarUrl');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // If private, check if owner
    if (project.visibility !== 'Public') {
      const isOwner = req.user && project.ownerId._id.toString() === req.user._id.toString();
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
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Verify ownership
    if (project.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    // Clean up associated files (and optionally other models if imported)
    await File.deleteMany({ projectId: project._id });
    await CollaborationSession.deleteMany({ projectId: project._id });
    await Snapshot.deleteMany({ projectId: project._id });
    await Comment.deleteMany({ projectId: project._id });

    await Project.findByIdAndDelete(project._id);

    res.json({ message: 'Project removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
