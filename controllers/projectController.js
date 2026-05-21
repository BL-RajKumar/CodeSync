import Project from '../models/Project.js';
import User from '../models/User.js';
import CollaborationSession from '../models/CollaborationSession.js';

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
// @access  Public
export const getPublicProjects = async (req, res) => {
  try {
    const { name, language, owner } = req.query;
    const query = { visibility: 'Public' };

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
      query.ownerId = { $in: userIds };
    }
    console.log(query);
    const projects = await Project.find(query)
      .populate('ownerId', 'username avatarUrl')
      .sort({ createdAt: -1 });

    res.json(projects);
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
