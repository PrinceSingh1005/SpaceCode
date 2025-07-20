import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const CollaborationPanel = ({ projects, onUpdate }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const socket = io('http://localhost:5000', {
    auth: { token: localStorage.getItem('token') },
  });

  useEffect(() => {
    const ownedProjects = projects.filter((p) => p.owner === localStorage.getItem('userId'));
    if (ownedProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(ownedProjects[0]._id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    const selectedProject = projects.find(p => p._id === selectedProjectId);
    if (selectedProject && selectedProject.inviteCode && selectedProject.sessionActive) {
      setInviteCode(selectedProject.inviteCode);
      const newMeetingLink = `http://localhost:5173/meeting/${selectedProject._id}`;
      setMeetingLink(newMeetingLink);
    } else {
      setInviteCode('');
      setMeetingLink('');
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    socket.on('projectUpdate', (updatedProject) => {
      if (updatedProject._id === selectedProjectId) {
        setInviteCode(updatedProject.inviteCode || '');
      }
      onUpdate(updatedProject);
    });

    socket.on('meetingUpdate', (updatedMeeting) => {
      onUpdate();
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedProjectId, onUpdate]);

  const generateInvite = async () => {
    if (!selectedProjectId) {
      setError('Please select a project to invite collaborators');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `http://localhost:5000/api/projects/${selectedProjectId}/invite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInviteCode(data.inviteCode);
      setMeetingLink(data.meetingLink);
      setError('');
      socket.emit('projectUpdate', { _id: selectedProjectId, inviteCode: data.inviteCode });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!selectedProjectId) {
      setError('Please select a project to schedule a meeting');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start and end times are required');
      return;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      setError('End time must be after start time');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `http://localhost:5000/api/meetings/${selectedProjectId}`,
        { startTime, endTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetingLink(data.meetingLink);
      setError('');
      socket.emit('meetingUpdate', { ...data, projectId: selectedProjectId });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const joinWithCode = async () => {
    if (!joinCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/projects/join',
        { inviteCode: joinCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdate(data);
      setJoinCode('');
      setError('Successfully joined the project!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join with code');
    } finally {
      setLoading(false);
    }
  };

  const ownedProjects = projects.filter((p) => p.owner === localStorage.getItem('userId'));

  return (
    <div className="p-4 bg-white rounded-md shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-blue-700">Collaboration Tools</h3>
      <div className="space-y-6">
        <div>
          <h4 className="text-md font-medium mb-2 text-blue-600">Invite Collaborator</h4>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-2 border rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a Project</option>
            {ownedProjects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={generateInvite}
            disabled={loading || !selectedProjectId}
            className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {inviteCode ? 'Copy Invite Code' : 'Start New Session & Get Invite'}
          </button>
          {inviteCode && (
            <div className="mt-2 p-2 bg-gray-50 rounded-md">
              <p className="font-medium">Invite Code: <span className="text-blue-600">{inviteCode}</span></p>
              <p className="mt-1">
                Meeting Link:{' '}
                <a href={meetingLink} className="text-blue-500 hover:underline">
                  {meetingLink}
                </a>
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                  setError('Invite code copied to clipboard!');
                  setTimeout(() => setError(''), 2000);
                }}
                className="mt-2 p-2 bg-green-600 text-white rounded-md hover:bg-green-700 w-full"
              >
                Copy Invite
              </button>
            </div>
          )}
        </div>
        <div>
          <h4 className="text-md font-medium mb-2 text-blue-600">Schedule Meeting</h4>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-2 border rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a Project</option>
            {ownedProjects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="flex space-x-2">
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            />
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            />
            <button
              onClick={createMeeting}
              disabled={loading || !selectedProjectId}
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              Create Meeting
            </button>
          </div>
          {meetingLink && !inviteCode && (
            <p className="mt-2 text-blue-500">
              Meeting Link:{' '}
              <a href={meetingLink} className="hover:underline">
                {meetingLink}
              </a>
            </p>
          )}
        </div>
        <div>
          <h4 className="text-md font-medium mb-2 text-blue-600">Join with Code</h4>
          <div className="flex space-x-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter Invite Code"
              className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            />
            <button
              onClick={joinWithCode}
              disabled={loading}
              className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 transition-colors"
            >
              Join
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;