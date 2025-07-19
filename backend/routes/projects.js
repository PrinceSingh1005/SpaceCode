const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');


router.post('/', authMiddleware(), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      console.log('Create project failed: Missing name', req.body);
      return res.status(400).json({ error: 'Project name required' });
    }

    const project = new Project({
      name,
      owner: req.user.id,
      collaborators: [req.user.id],
      admin: req.user.id,
    });
    await project.save();

    // Update user's projectsOwned
    const user = await User.findById(req.user.id);
    await user.updateProjectAssociations(project._id, true);
    console.log('Project created:', project._id);
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all projects for the authenticated user
router.get('/', authMiddleware(), async (req, res) => {
  try {
    console.log('User role during fetch:', req.user.role); // Debug user role
    let projects = await Project.find({
        $or: [
          { owner: req.user.id },
          { collaborators: req.user.id, inviteCode: { $ne: null }, sessionActive: true },
        ],
      }).populate('collaborators', 'username');
      console.log('Non-Admin fetching own projects:', projects.length);

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add collaborator (Only admin can invite)
router.post('/:projectId/collaborators', authMiddleware(), async (req, res) => {
  try {
    const { userId, inviteCode } = req.body;
    if (!userId) {
      console.log('Add collaborator failed: Missing userId', req.body);
      return res.status(400).json({ error: 'User ID required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Add collaborator failed: Invalid userId', userId);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      console.log('Add collaborator failed: Project not found', req.params.projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only the admin (inviter) or global Admin can add collaborators
    if (project.admin.toString() !== req.user.id && req.user.role !== 'admin') {
      console.log('Add collaborator failed: Access denied', { userId: req.user.id, projectAdmin: project.admin });
      return res.status(403).json({ error: 'Only the admin can invite collaborators' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('Add collaborator failed: User not found', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    if (inviteCode && project.inviteCode !== inviteCode) {
      console.log('Add collaborator failed: Invalid invite code', { provided: inviteCode, expected: project.inviteCode });
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    if (!project.collaborators.includes(userId)) {
      project.collaborators.push(userId);
      await project.save();

      // Update user's projectsJoined
      await user.updateProjectAssociations(project._id);
      console.log('Collaborator added:', { projectId: project._id, userId });
    } else {
      console.log('Collaborator already added:', { projectId: project._id, userId });
    }

    res.json(project);
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get project details (Collaborator or Viewer)
router.get('/:projectId', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('collaborators', 'username');
    if (!project) {
      console.log('Get project failed: Project not found', req.params.projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is owner or active collaborator
    const user = await User.findById(req.user.id);
    const isOwner = project.owner.toString() === req.user.id;
    const isCollaborator = project.collaborators.includes(req.user.id) && project.sessionActive;
    if (!isOwner && !isCollaborator && req.user.role !== 'admin') {
      console.log('Get project failed: Not authorized', { userId: req.user.id, projectId: req.params.projectId });
      return res.status(403).json({ error: 'Not authorized to access this project' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join project with invite code
router.post('/join', authMiddleware(), async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      console.log('Join project failed: Missing invite code', req.body);
      return res.status(400).json({ error: 'Invite code required' });
    }

    const project = await Project.findOne({ inviteCode, sessionActive: true });
    if (!project) {
      console.log('Join project failed: Invalid or expired invite code', inviteCode);
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }

    if (project.collaborators.includes(req.user.id)) {
      console.log('Join project failed: User already a collaborator', { userId: req.user.id, projectId: project._id });
      return res.status(400).json({ error: 'Already a collaborator' });
    }

    project.collaborators.push(req.user.id);
    await project.save();

    // Update user's projectsJoined
    const user = await User.findById(req.user.id);
    await user.updateProjectAssociations(project._id);
    console.log('User joined project as collaborator:', { userId: req.user.id, projectId: project._id });

    res.json(project);
  } catch (error) {
    console.error('Join project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate invite code and meeting link (Only project owner can generate, resets collaborators)
router.post('/:projectId/invite', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      console.log('Generate invite failed: Project not found', req.params.projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only the project owner can generate invites
    if (project.owner.toString() !== req.user.id) {
      console.log('Generate invite failed: Access denied', {
        userId: req.user.id,
        projectOwner: project.owner,
        userRole: req.user.role,
      });
      return res.status(403).json({ error: 'Only the project owner can generate invites' });
    }

    const inviteCode = uuidv4().slice(0, 8); // New 8-character unique code
    const meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/meeting/${project._id}`;
    // Reset collaborators to end previous session (keep owner)
    project.collaborators = [project.owner];
    project.inviteCode = inviteCode;
    project.sessionActive = true;
    await project.save();

    // Remove project from collaborators' projectsJoined
    const User = mongoose.model('User');
    await User.updateMany(
      { _id: { $in: project.collaborators }, projectsJoined: project._id },
      { $pull: { projectsJoined: project._id } }
    );

    console.log('New invite generated, session reset:', { projectId: project._id, inviteCode, meetingLink });
    res.json({ inviteCode, meetingLink });
  } catch (error) {
    console.error('Generate invite error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


router.delete('/:projectId/collaborators/:userId', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId });
    if (!project) {
      console.log('Remove collaborator failed: Project not found', req.params.projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    const userId = req.params.userId;
    if (project.owner.toString() === userId) {
      console.log('Remove collaborator failed: Cannot remove project owner', userId);
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    if (!project.collaborators.includes(userId)) {
      console.log('Remove collaborator failed: User not a collaborator', userId);
      return res.status(404).json({ error: 'User is not a collaborator' });
    }

    project.collaborators = project.collaborators.filter((id) => id.toString() !== userId);
    await project.save();
    console.log('Collaborator removed:', { projectId: project._id, userId });

    const io = req.app.get('io');
    if (io) {
      io.to(project._id.toString()).emit('userDisconnected', userId);
      io.to(project._id.toString()).emit('projectUpdate', project);
    }

    res.json({ message: 'Collaborator removed', project });
  } catch (error) {
    console.error('Remove collaborator error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get file content (create if not exists)
router.get('/:projectId/files/:fileName', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      console.log('Get file failed: Project not found or unauthorized', req.params.projectId);
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    let file = project.files.find((f) => f.name === req.params.fileName);
    if (!file) {
      console.log('File not found, creating:', req.params.fileName);
      file = { name: req.params.fileName, content: '// Start coding here', lastModified: new Date() };
      project.files.push(file);
      await project.save();
    }

    console.log('File content retrieved:', { projectId: project._id, fileName: file.name });
    res.json({ content: file.content, lastModified: file.lastModified });
  } catch (error) {
    console.error('Get file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Update or create file content
router.post('/:projectId/files/:fileName', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      console.log('Update file failed: Project not found or unauthorized', req.params.projectId);
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    let file = project.files.find((f) => f.name === req.params.fileName);
    if (file) {
      file.content = content;
      file.lastModified = new Date();
    } else {
      file = { name: req.params.fileName, content, lastModified: new Date() };
      project.files.push(file);
    }

    await project.save();
    console.log('File updated:', { projectId: project._id, fileName: req.params.fileName });

    const io = req.app.get('io');
    if (io) {
      io.to(project._id.toString()).emit('codeChange', {
        projectId: project._id,
        fileName: req.params.fileName,
        content,
        senderId: req.user.id,
      });
    }

    res.json({ message: 'File updated', content, lastModified: file.lastModified });
  } catch (error) {
    console.error('Update file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// List all files in a project (optional)
router.get('/:projectId/files', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      console.log('Get files failed: Project not found or unauthorized', req.params.projectId);
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    console.log('Files listed:', { projectId: project._id, fileCount: project.files.length });
    res.json(project.files.map((f) => ({ name: f.name, lastModified: f.lastModified })));
  } catch (error) {
    console.error('Get files error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Create a new file in a project (optional)
router.post('/:projectId/files', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      console.log('Create file failed: Project not found or unauthorized', req.params.projectId);
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const { name, content = '' } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }

    if (project.files.find((f) => f.name === name)) {
      return res.status(400).json({ error: 'File already exists' });
    }

    project.files.push({ name, content, lastModified: new Date() });
    await project.save();
    console.log('File created:', { projectId: project._id, fileName: name });

    res.json({ message: 'File created', name, lastModified: new Date() });
  } catch (error) {
    console.error('Create file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;