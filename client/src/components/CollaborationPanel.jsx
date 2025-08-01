import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const VITE_FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

const CollaborationPanel = ({ projects, onUpdate }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [startTime, setStartTime] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const socket = io(VITE_BACKEND_URL, {
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
      const newMeetingLink = `${VITE_FRONTEND_URL}/meeting/${selectedProject._id}`;
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
        `${VITE_BACKEND_URL}/api/projects/${selectedProjectId}/invite`,
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
    if (!startTime) {
      setError('Start time is required');
      return;
    }
    // Set endTime to 1 hour after startTime
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${VITE_BACKEND_URL}/api/meetings/${selectedProjectId}`,
        { startTime, endTime: endDate.toISOString() },
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
        `${VITE_BACKEND_URL}/api/projects/join`,
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
    <div className="max-h-[90vh] overflow-y-auto p-4 bg-white rounded-xl shadow-lg space-y-4 border border-gray-200">
      <h3 className="text-xl font-semibold text-blue-700">Collaboration Tools</h3>

      {/* Invite Collaborator Section */}
      <div className="space-y-2 border-b pb-4">
        <h4 className="text-md font-medium text-blue-600">Invite Collaborator</h4>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors text-sm font-medium"
        >
          {inviteCode ? 'Copy Invite Code' : 'Start Session & Get Invite'}
        </button>

        {inviteCode && (
          <div className="mt-2 p-3 bg-gray-100 rounded-md text-sm space-y-1">
            <p className="font-medium">Invite Code: <span className="text-blue-600">{inviteCode}</span></p>
            <p>
              Meeting Link:{' '}
              <a href={meetingLink} className="text-blue-500 hover:underline break-all">{meetingLink}</a>
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode);
                setError('Invite code copied!');
                setTimeout(() => setError(''), 2000);
              }}
              className="w-full p-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              Copy Invite
            </button>
          </div>
        )}
      </div>

      {/* Schedule Meeting Section */}
      <div className="space-y-2 border-b pb-4">
        <h4 className="text-md font-medium text-blue-600">Schedule Meeting</h4>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a Project</option>
          {ownedProjects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
          />
          <button
            onClick={createMeeting}
            disabled={loading || !selectedProjectId}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium w-full sm:w-auto"
          >
            Create Meeting
          </button>
        </div>
        {meetingLink && (
          <p className="text-sm mt-1 text-blue-500">
            Link: <a href={meetingLink} className="hover:underline break-all">{meetingLink}</a>
          </p>
        )}
      </div>

      {/* Join with Code Section */}
      <div className="space-y-2">
        <h4 className="text-md font-medium text-blue-600">Join with Code</h4>
        <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter Invite Code"
            className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 text-sm"
          />
          <button
            onClick={joinWithCode}
            disabled={loading}
            className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 transition-colors text-sm font-medium"
          >
            Join
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );

}

export default CollaborationPanel;