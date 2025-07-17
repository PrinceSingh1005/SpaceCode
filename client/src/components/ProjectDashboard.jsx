import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CodeEditor from './CodeEditor';

const ProjectDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const { data } = await axios.get('http://localhost:5000/api/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Create a new project
  const createProject = async () => {
    if (!newProjectName) {
      setError('Project name is required');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/projects',
        { name: newProjectName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects([...projects, data]);
      setNewProjectName('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  // Invite a collaborator
  const inviteUser = async () => {
    if (!inviteUserId) {
      setError('User ID is required');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `http://localhost:5000/api/projects/${selectedProject._id}/invite`,
        { userId: inviteUserId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects(projects.map((p) => (p._id === data._id ? data : p)));
      setInviteUserId('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  // Create a meeting
  const createMeeting = async () => {
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
        `http://localhost:5000/api/meetings/${selectedProject._id}`,
        { startTime, endTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetingLink(data.meetingLink);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/4 bg-gray-100 p-4">
        <h2 className="text-xl font-bold mb-4">Projects</h2>
        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New Project Name"
            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createProject}
            disabled={loading}
            className="w-full p-2 mt-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
          >
            Create Project
          </button>
        </div>
        {projects.map((project) => (
          <div
            key={project._id}
            className={`p-2 cursor-pointer hover:bg-gray-200 rounded-md ${
              selectedProject?._id === project._id ? 'bg-blue-100' : ''
            }`}
            onClick={() => {
              setSelectedProject(project);
              setMeetingLink('');
              setError('');
            }}
          >
            {project.name}
          </div>
        ))}
      </div>
      {/* Main Content */}
      <div className="w-3/4 p-4">
        {selectedProject ? (
          <>
            <h2 className="text-xl font-bold mb-4">{selectedProject.name}</h2>
            <CodeEditor projectId={selectedProject._id} fileName="index.js" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Invite Collaborator</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  placeholder="User ID"
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={inviteUser}
                  disabled={loading}
                  className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                >
                  Invite
                </button>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Create Meeting</h3>
              <div className="flex space-x-2">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={createMeeting}
                  disabled={loading}
                  className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                >
                  Create Meeting
                </button>
              </div>
              {meetingLink && (
                <p className="mt-2">
                  Meeting Link:{' '}
                  <a href={meetingLink} className="text-blue-500 hover:underline">
                    {meetingLink}
                  </a>
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-600">Select a project to start collaborating.</p>
        )}
      </div>
    </div>
  );
};

export default ProjectDashboard;