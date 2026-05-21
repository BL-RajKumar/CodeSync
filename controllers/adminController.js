import User from '../models/User.js';

// @desc    Get all users (with search and filters)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    
    // Construct query object
    const query = {};

    // Exclude the current admin themselves from the list to avoid self-suspension/deletion
    query._id = { $ne: req.user._id };

    // Search query matching username, email, or fullName
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { fullName: searchRegex }
      ];
    }

    // Role filter
    if (role && ['Guest', 'Developer', 'Admin'].includes(role)) {
      query.role = role;
    }

    // Status filter
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'suspended') {
        query.isActive = false;
      }
    }

    // Fetch users sorted by newest first, excluding passwordHash
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle user suspension status
// @route   PUT /api/admin/users/:id/suspend
// @access  Private/Admin
export const suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle active state
    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User status updated successfully. ${user.username} is now ${user.isActive ? 'Active' : 'Suspended'}.`,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Permanently delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: `User "${user.username}" has been permanently deleted.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
