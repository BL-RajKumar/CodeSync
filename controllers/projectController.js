import Project from '../models/Project.js';
import User from '../models/User.js';

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
