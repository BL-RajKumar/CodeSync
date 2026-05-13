import Project from '../models/Project.js';

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
    const { name, language } = req.query;
    const query = { visibility: 'Public' };

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    if (language) {
      query.language = { $regex: new RegExp(`^${language}$`, 'i') };
    }

    const projects = await Project.find(query)
      .populate('ownerId', 'username avatarUrl')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
