import crypto from 'crypto';
import * as Diff from 'diff';
import Snapshot from '../models/Snapshot.js';
import File from '../models/File.js';
import Project from '../models/Project.js';
import { createNotification } from '../utils/notificationService.js';

// Helper to generate SHA-256 hash of string content
const generateHash = (content) => {
  return crypto.createHash('sha256').update(content || '').digest('hex');
};

/**
 * @desc    Create a new snapshot for a file
 * @route   POST /api/snapshots
 * @access  Private
 */
export const createSnapshot = async (req, res) => {
  try {
    const { fileId, message, branch, tag } = req.body;
    
    // Find the file to get current content and projectId
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const currentBranch = branch || 'main';

    // Find the latest snapshot for this file on this branch to set parentSnapshotId
    const latestSnapshot = await Snapshot.findOne({ fileId, branch: currentBranch }).sort({ createdAt: -1 });

    const hash = generateHash(file.content);

    const snapshot = new Snapshot({
      projectId: file.projectId,
      fileId: file._id,
      authorId: req.user._id, // Assuming auth middleware sets req.user
      message: message || `Update ${file.name}`,
      content: file.content,
      hash,
      parentSnapshotId: latestSnapshot ? latestSnapshot._id : null,
      branch: currentBranch,
      tag: tag || null,
    });

    await snapshot.save();

    // Notify project owner of new snapshot if created by a collaborator
    try {
      const project = await Project.findById(file.projectId);
      if (project && project.ownerId.toString() !== req.user._id.toString()) {
        await createNotification({
          recipientId: project.ownerId,
          actorId: req.user._id,
          type: 'new_snapshot',
          title: 'New Snapshot Created',
          message: `${req.user.username} saved a new snapshot on file '${file.name}' (Branch: ${currentBranch}).`,
          relatedId: `${file.projectId}/${file._id}`,
          relatedType: 'Snapshot',
        });
      }
    } catch (notifErr) {
      console.error('[Snapshot Notification] Error:', notifErr);
    }

    res.status(201).json(snapshot);
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ message: 'Server error while creating snapshot' });
  }
};

/**
 * @desc    Get snapshot history for a file
 * @route   GET /api/snapshots/file/:fileId
 * @access  Private
 */
export const getSnapshotsForFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { branch } = req.query;

    const query = { fileId };
    if (branch) {
      query.branch = branch;
    }

    const snapshots = await Snapshot.find(query)
      .sort({ createdAt: -1 })
      .populate('authorId', 'username email'); // Populate author details if needed

    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({ message: 'Server error fetching snapshots' });
  }
};

/**
 * @desc    Get a specific snapshot by ID
 * @route   GET /api/snapshots/:id
 * @access  Private
 */
export const getSnapshot = async (req, res) => {
  try {
    const snapshot = await Snapshot.findById(req.params.id)
      .populate('authorId', 'username email');

    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found' });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ message: 'Server error fetching snapshot' });
  }
};

/**
 * @desc    Restore a file to a specific snapshot state (creates a new snapshot)
 * @route   POST /api/snapshots/:id/restore
 * @access  Private
 */
export const restoreSnapshot = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the target snapshot
    const targetSnapshot = await Snapshot.findById(id);
    if (!targetSnapshot) {
      return res.status(404).json({ message: 'Target snapshot not found' });
    }

    // 2. Get the current file
    const file = await File.findById(targetSnapshot.fileId);
    if (!file) {
      return res.status(404).json({ message: 'Associated file not found' });
    }

    // 3. Update the live file's content
    file.content = targetSnapshot.content;
    file.lastEditedBy = req.user._id;
    await file.save();

    // 4. Create a new snapshot capturing this restore action
    const latestSnapshot = await Snapshot.findOne({ 
      fileId: file._id, 
      branch: targetSnapshot.branch 
    }).sort({ createdAt: -1 });

    const hash = generateHash(file.content);

    const newSnapshot = new Snapshot({
      projectId: file.projectId,
      fileId: file._id,
      authorId: req.user._id,
      message: `Restored from snapshot ${targetSnapshot.hash.substring(0, 8)}`,
      content: file.content,
      hash,
      parentSnapshotId: latestSnapshot ? latestSnapshot._id : null,
      branch: targetSnapshot.branch,
    });

    await newSnapshot.save();

    res.json({
      message: 'Restore successful',
      file,
      newSnapshot
    });
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    res.status(500).json({ message: 'Server error while restoring snapshot' });
  }
};

/**
 * @desc    Compare two snapshots and return a diff (Myers algorithm via 'diff' package)
 * @route   GET /api/snapshots/diff/:id1/:id2
 * @access  Private
 */
export const compareSnapshots = async (req, res) => {
  try {
    const { id1, id2 } = req.params;

    const snapshot1 = await Snapshot.findById(id1);
    const snapshot2 = await Snapshot.findById(id2);

    if (!snapshot1 || !snapshot2) {
      return res.status(404).json({ message: 'One or both snapshots not found' });
    }

    // Create a patch using Myers algorithm (diffLines)
    const diff = Diff.createTwoFilesPatch(
      `Snapshot ${snapshot1.hash.substring(0,8)}`, // oldHeader
      `Snapshot ${snapshot2.hash.substring(0,8)}`, // newHeader
      snapshot1.content || '',
      snapshot2.content || '',
      '',
      '',
      { context: 3 }
    );

    res.json({
      snapshot1Id: snapshot1._id,
      snapshot2Id: snapshot2._id,
      diff
    });
  } catch (error) {
    console.error('Error comparing snapshots:', error);
    res.status(500).json({ message: 'Server error while comparing snapshots' });
  }
};

/**
 * @desc    Get all unique branches for a file
 * @route   GET /api/snapshots/file/:fileId/branches
 * @access  Private
 */
export const getBranchesForFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const branches = await Snapshot.distinct('branch', { fileId });
    res.json(branches.length ? branches : ['main']);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ message: 'Server error fetching branches' });
  }
};

/**
 * @desc    Create a new branch from an existing snapshot
 * @route   POST /api/snapshots/:id/branch
 * @access  Private
 */
export const createBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { branchName } = req.body;

    if (!branchName || typeof branchName !== 'string') {
      return res.status(400).json({ message: 'Valid branchName is required' });
    }

    const sourceSnapshot = await Snapshot.findById(id);
    if (!sourceSnapshot) {
      return res.status(404).json({ message: 'Source snapshot not found' });
    }

    // Check if branch already exists
    const existingInBranch = await Snapshot.findOne({ fileId: sourceSnapshot.fileId, branch: branchName });
    if (existingInBranch) {
      return res.status(400).json({ message: `Branch '${branchName}' already exists` });
    }

    const newSnapshot = new Snapshot({
      projectId: sourceSnapshot.projectId,
      fileId: sourceSnapshot.fileId,
      authorId: req.user._id,
      message: `Branched to ${branchName}`,
      content: sourceSnapshot.content,
      hash: sourceSnapshot.hash, // Identical content -> identical hash
      parentSnapshotId: sourceSnapshot._id,
      branch: branchName,
      tag: null, // Tags shouldn't typically carry over to a new branch automatically
    });

    await newSnapshot.save();
    res.status(201).json(newSnapshot);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ message: 'Server error creating branch' });
  }
};

/**
 * @desc    Add or update a semantic version tag on a snapshot
 * @route   PUT /api/snapshots/:id/tag
 * @access  Private
 */
export const addTagToSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    const snapshot = await Snapshot.findById(id);
    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found' });
    }

    snapshot.tag = tag ? tag.trim() : null;
    await snapshot.save();

    res.json(snapshot);
  } catch (error) {
    console.error('Error tagging snapshot:', error);
    res.status(500).json({ message: 'Server error tagging snapshot' });
  }
};
