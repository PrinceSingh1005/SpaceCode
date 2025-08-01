const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Project = require('../models/Project');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
router.post('/:projectId', authMiddleware, async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const meeting = new Meeting({
      projectId: req.params.projectId,
      meetingId: uuidv4(),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdBy: req.user.id,
    });
    await meeting.save();

    const meetingLink = `${FRONTEND_URL}/projects/?meetingId=${meeting.meetingId}`;

    res.status(201).json({ meeting, meetingLink });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:meetingId', authMiddleware, async (req, res) => {
  try {
    console.log('Meeting ID:', req.params.meetingId);
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId }).populate('projectId');
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const now = new Date();
    if (now < meeting.startTime || now > meeting.endTime) {
      return res.status(403).json({ error: 'Meeting is not active' });
    }

    if (!meeting.projectId.collaborators.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a project collaborator' });
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;