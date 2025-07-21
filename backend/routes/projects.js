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
      return res.status(400).json({ error: 'Project name required' });
    }
    const project = new Project({
      name,
      owner: req.user.id,
      collaborators: [req.user.id],
      admin: req.user.id,
    });
    await project.save();
    const user = await User.findById(req.user.id);
    await user.updateProjectAssociations(project._id, true);
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authMiddleware(), async (req, res) => {
  try {
    let projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id, inviteCode: { $ne: null }, sessionActive: true },
      ],
    }).populate('collaborators', 'username');
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:projectId/collaborators', authMiddleware(), async (req, res) => {
  try {
    const { userId, inviteCode } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.admin.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the admin can invite collaborators' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (inviteCode && project.inviteCode !== inviteCode) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }
    if (!project.collaborators.includes(userId)) {
      project.collaborators.push(userId);
      await project.save();
      await user.updateProjectAssociations(project._id);
    }
    res.json(project);
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:projectId', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('collaborators', 'username');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const user = await User.findById(req.user.id);
    const isOwner = project.owner.toString() === req.user.id;
    const isCollaborator = project.collaborators.includes(req.user.id) && project.sessionActive;
    if (!isOwner && !isCollaborator && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to access this project' });
    }
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join', authMiddleware(), async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }
    const project = await Project.findOne({ inviteCode, sessionActive: true });
    if (!project) {
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }
    if (project.collaborators.includes(req.user.id)) {
      return res.status(400).json({ error: 'Already a collaborator' });
    }
    project.collaborators.push(req.user.id);
    await project.save();
    const user = await User.findById(req.user.id);
    await user.updateProjectAssociations(project._id);
    res.json(project);
  } catch (error) {
    console.error('Join project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:projectId/invite', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can generate invites' });
    }

    const meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${project._id}`;

    if (project.sessionActive && project.inviteCode) {
      return res.json({ inviteCode: project.inviteCode, meetingLink });
    }

    const inviteCode = uuidv4().slice(0, 8);
    project.collaborators = [project.owner];
    project.inviteCode = inviteCode;
    project.sessionActive = true;
    await project.save();

    const User = mongoose.model('User');
    await User.updateMany(
      { _id: { $in: project.collaborators }, projectsJoined: project._id },
      { $pull: { projectsJoined: project._id } }
    );

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
      return res.status(404).json({ error: 'Project not found' });
    }
    const userId = req.params.userId;
    if (project.owner.toString() === userId) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }
    if (!project.collaborators.includes(userId)) {
      return res.status(404).json({ error: 'User is not a collaborator' });
    }
    project.collaborators = project.collaborators.filter((id) => id.toString() !== userId);
    await project.save();
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

router.get('/:projectId/files/:fileName', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }
    const file = project.files.find((f) => f.name === req.params.fileName);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    const version = Math.floor(file.lastModified.getTime() / 1000);
    res.json({ content: file.content, lastModified: file.lastModified, version });
  } catch (error) {
    console.error('Get file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

router.post('/:projectId/files/:fileName', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const { content, version: clientVersion } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    let file = project.files.find((f) => f.name === req.params.fileName);
    const currentVersion = file ? Math.floor(file.lastModified.getTime() / 1000) : 0;

    if (file) {
      if (clientVersion && clientVersion < currentVersion) {
        return res.status(409).json({ error: 'Conflict detected, please refresh and try again', currentVersion });
      }
      file.content = content;
      file.lastModified = new Date();
    } else {
      project.files.push({ name: req.params.fileName, content, lastModified: new Date() });
    }

    await project.save();

    const newVersion = Math.floor(file?.lastModified.getTime() / 1000) || Math.floor(new Date().getTime() / 1000);

    res.json({ message: 'File updated', content, lastModified: file?.lastModified || new Date(), version: newVersion });
  } catch (error) {
    console.error('Update file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


router.get('/:projectId/files', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }
    res.json(project.files.map((f) => ({ name: f.name, lastModified: f.lastModified })));
  } catch (error) {
    console.error('Get files error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

router.post('/:projectId/files', authMiddleware(), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      $or: [{ owner: req.user.id }, { collaborators: req.user.id }],
    });
    if (!project) {
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
    res.json({ message: 'File created', name, lastModified: new Date() });
  } catch (error) {
    console.error('Create file error:', error.message, { stack: error.stack });
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;