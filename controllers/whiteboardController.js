import Whiteboard from '../models/Whiteboard.js';

// @desc    Get whiteboard by Project ID
// @route   GET /api/whiteboard/:projectId
// @access  Private/Public (depending on project visibility)
export const getWhiteboard = async (req, res) => {
  const { projectId } = req.params;

  try {
    let whiteboard = await Whiteboard.findOne({ projectId });
    
    if (!whiteboard) {
      // If whiteboard doesn't exist, we can return empty elements and state
      return res.status(200).json({
        projectId,
        elements: [],
        appState: {}
      });
    }

    res.status(200).json(whiteboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save/Update whiteboard for a Project
// @route   POST /api/whiteboard/:projectId
// @access  Private
export const updateWhiteboard = async (req, res) => {
  const { projectId } = req.params;
  const { elements, appState } = req.body;

  try {
    let whiteboard = await Whiteboard.findOneAndUpdate(
      { projectId },
      { elements, appState },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(whiteboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
