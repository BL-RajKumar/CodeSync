import Comment from '../models/Comment.js';
import File from '../models/File.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Helper: parse @mentions from content and create notifications
const parseMentionsAndNotify = async (content, senderId, projectId, fileId) => {
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    const mentionedUser = await User.findOne({ username });
    if (mentionedUser && mentionedUser._id.toString() !== senderId.toString()) {
      await Notification.create({
        recipientId: mentionedUser._id,
        senderId,
        type: 'mention',
        message: `You were mentioned in a code review comment.`,
        link: `/editor/${projectId}?file=${fileId}`,
      });
    }
  }
};

/**
 * @desc    Add an inline comment (or a reply) to a file
 * @route   POST /api/comments
 * @access  Private
 */
export const addComment = async (req, res) => {
  try {
    let { fileId, projectId, snapshotId, lineNumber, content, parentCommentId } = req.body;

    // Extract raw string IDs if they are passed as populated objects
    if (fileId && typeof fileId === 'object') fileId = fileId._id || fileId.id;
    if (projectId && typeof projectId === 'object') projectId = projectId._id || projectId.id;
    if (snapshotId && typeof snapshotId === 'object') snapshotId = snapshotId._id || snapshotId.id;

    if (!fileId || !projectId || !lineNumber || !content) {
      return res.status(400).json({ message: 'fileId, projectId, lineNumber, and content are required' });
    }

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const comment = await Comment.create({
      projectId,
      fileId,
      snapshotId: snapshotId || null,
      authorId: req.user._id,
      parentCommentId: parentCommentId || null,
      lineNumber,
      content,
      resolved: false,
    });

    // Parse @mentions and create notifications
    await parseMentionsAndNotify(content, req.user._id, projectId, fileId);

    const populated = await Comment.findById(comment._id).populate('authorId', 'username email');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
};

/**
 * @desc    Update comment content (author only)
 * @route   PUT /api/comments/:id
 * @access  Private
 */
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    const { content } = req.body;
    comment.content = content;
    await comment.save();

    // Re-parse mentions after edit
    await parseMentionsAndNotify(content, req.user._id, comment.projectId, comment.fileId);

    const populated = await Comment.findById(comment._id).populate('authorId', 'username email');
    res.json(populated);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Server error updating comment' });
  }
};

/**
 * @desc    Delete a comment and all its replies (author only)
 * @route   DELETE /api/comments/:id
 * @access  Private
 */
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Delete the comment and all its replies
    await Comment.deleteMany({ parentCommentId: comment._id });
    await comment.deleteOne();

    res.json({ message: 'Comment and replies deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error deleting comment' });
  }
};

/**
 * @desc    Toggle the resolved state of a comment thread
 * @route   PUT /api/comments/:id/resolve
 * @access  Private
 */
export const toggleResolve = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    comment.resolved = !comment.resolved;
    await comment.save();

    res.json(comment);
  } catch (error) {
    console.error('Error toggling resolve:', error);
    res.status(500).json({ message: 'Server error toggling resolve' });
  }
};

/**
 * @desc    Get all top-level comments for a file, with replies nested inside
 * @route   GET /api/comments/file/:fileId
 * @access  Private
 */
export const getFileComments = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { snapshotId } = req.query;

    const query = { fileId, parentCommentId: null };
    if (snapshotId) query.snapshotId = snapshotId;

    // Get all top-level comments
    const topLevel = await Comment.find(query)
      .sort({ lineNumber: 1, createdAt: 1 })
      .populate('authorId', 'username email');

    // Get all replies for these comments
    const topLevelIds = topLevel.map(c => c._id);
    const replies = await Comment.find({ parentCommentId: { $in: topLevelIds } })
      .sort({ createdAt: 1 })
      .populate('authorId', 'username email');

    // Nest replies into their parent
    const result = topLevel.map(c => {
      const cObj = c.toJSON();
      cObj.replies = replies
        .filter(r => r.parentCommentId.toString() === c._id.toString())
        .map(r => r.toJSON());
      return cObj;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching file comments:', error);
    res.status(500).json({ message: 'Server error fetching comments' });
  }
};

/**
 * @desc    Get all comments across an entire project (UC36 - central view)
 * @route   GET /api/comments/project/:projectId
 * @access  Private
 */
export const getProjectComments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { resolved } = req.query;

    const query = { projectId, parentCommentId: null };
    if (resolved === 'true') query.resolved = true;
    if (resolved === 'false') query.resolved = false;

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .populate('authorId', 'username email')
      .populate('fileId', 'name path');

    // Nest replies
    const topLevelIds = comments.map(c => c._id);
    const replies = await Comment.find({ parentCommentId: { $in: topLevelIds } })
      .sort({ createdAt: 1 })
      .populate('authorId', 'username email');

    const result = comments.map(c => {
      const cObj = c.toJSON();
      cObj.replies = replies
        .filter(r => r.parentCommentId.toString() === c._id.toString())
        .map(r => r.toJSON());
      return cObj;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching project comments:', error);
    res.status(500).json({ message: 'Server error fetching project comments' });
  }
};
