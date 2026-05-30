import Notification from '../models/Notification.js';

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const recipientId = req.user._id;

    // Fetch all notifications for this recipient, sorted by newest first
    const notifications = await Notification.find({ recipientId })
      .populate('actorId', 'username avatarUrl')
      .sort({ createdAt: -1 });

    // Calculate unread count
    const unreadCount = await Notification.countDocuments({
      recipientId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Verify ownership
    if (notification.recipientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to read this notification' });
    }

    notification.isRead = true;
    await notification.save();

    // Recalculate and return unread count
    const unreadCount = await Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false,
    });

    res.json({
      message: 'Notification marked as read',
      notification,
      unreadCount,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error marking notification as read' });
  }
};

// @desc    Mark all notifications as read for current user
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const recipientId = req.user._id;

    await Notification.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({
      message: 'All notifications marked as read',
      unreadCount: 0,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error marking all notifications as read' });
  }
};
