import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import CodeEditor from './CodeEditor';
import io from 'socket.io-client';
import CollaborationPanel from './CollaborationPanel';

const ProjectDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isColabOpen, setIsColabOpen] = useState(false);
  const socketRef = useRef(null);

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    socketRef.current.on('projectUpdate', (updatedProject) => {
      console.log('Project update received:', updatedProject);
      const fetchUpdatedProject = async () => {
        try {
          const token = localStorage.getItem('token');
          const { data } = await axios.get(
            `http://localhost:5000/api/projects/${updatedProject._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setProjects((prev) => prev.map((p) => (p._id === data._id ? data : p)));
          if (selectedProject?._id === data._id) {
            setSelectedProject(data);
          }
        } catch (err) {
          console.error('Failed to fetch updated project:', err);
          setError('Failed to update project data.');
        }
      };
      fetchUpdatedProject();
    });

    socketRef.current.on('meetingUpdate', (updatedMeeting) => {
      if (selectedProject?._id === updatedMeeting.projectId) {
        setMeetings((prev) =>
          prev.map((m) => (m._id === updatedMeeting._id ? updatedMeeting : m))
        );
      }
    });

    socketRef.current.on('codeChange', ({ projectId, code }) => {
      console.log('Code change received:', { projectId, code });
      if (selectedProject?._id === projectId) {
        setSelectedProject((prev) => ({ ...prev, files: prev.files.map(file =>
          file.name === 'index.js' ? { ...file, content: code } : file
        ) }));
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [selectedProject?._id]);

  // Fetch projects and meetings on mount
  useEffect(() => {
    const fetchData = async () => {
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
        console.error('Fetch projects error:', err.response?.data);
      } finally {
        setLoading(false);
      }
    };

    const fetchMeetings = async () => {
      if (selectedProject?._id) {
        try {
          const token = localStorage.getItem('token');
          const { data } = await axios.get(
            `http://localhost:5000/api/meetings/project/${selectedProject._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setMeetings(data);
        } catch (err) {
          console.error('Fetch meetings error:', err.response?.data || err.message);
          setMeetings([]);
          setError('Failed to load meetings. Please try again.');
        }
      }
    };

    fetchData();
    fetchMeetings();
  }, [selectedProject?._id]);

  // Create a new project
  const createProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/projects',
        { name: newProjectName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects([...projects, data]);
      setNewProjectName('');
      setError('');
      console.log('Project created:', data._id);
      socketRef.current.emit('projectUpdate', data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
      console.error('Create project error:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = (newProject) => {
    if (newProject) {
      setProjects((prev) => [...prev, newProject]);
    } else {
      const fetchData = async () => {
        const token = localStorage.getItem('token');
        const { data } = await axios.get('http://localhost:5000/api/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(data);
      };
      fetchData();
    }
  };

  return (
    <div className="relative flex h-screen bg-gray-100 text-gray-800">
      <button
        onClick={() => setIsColabOpen(!isColabOpen)}
        className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none z-10"
      >
        Colab
      </button>
      {isColabOpen && (
        <div className="absolute top-14 right-4 w-80 bg-white rounded-md shadow-lg p-4 z-10">
          <CollaborationPanel projects={projects} onUpdate={onUpdate} />
        </div>
      )}
      <div className="w-1/4 p-6 bg-white shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-blue-700">Projects</h2>
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-6">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New Project Name"
            className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createProject}
            disabled={loading}
            className="w-full p-3 mt-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            Create Project
          </button>
        </div>
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project._id}
              className={`p-3 cursor-pointer rounded-md shadow-sm ${
                selectedProject?._id === project._id ? 'bg-blue-100' : 'bg-white hover:bg-gray-100'
              }`}
              onClick={() => {
                console.log('Selecting project:', project._id);
                if (project._id) {
                  setSelectedProject(project);
                  setError('');
                  const fetchMeetings = async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const { data } = await axios.get(
                        `http://localhost:5000/api/meetings/project/${project._id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      setMeetings(data);
                      console.log('Meetings fetched:', data.length);
                    } catch (err) {
                      console.error('Fetch meetings error:', err.response?.data || err.message);
                      setMeetings([]);
                      setError('Failed to load meetings. Please try again.');
                    }
                  };
                  fetchMeetings().catch((err) => console.error('Meeting fetch failed:', err));
                } else {
                  console.error('Invalid project ID:', project);
                  setError('Invalid project selected.');
                }
              }}
            >
              <h3 className="font-medium">{project.name}</h3>
              <p className="text-sm text-gray-500">
                {project.collaborators && Array.isArray(project.collaborators)
                  ? `${project.collaborators.length} collaborators`
                  : '0 collaborators'}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="w-3/4 p-6">
        {selectedProject ? (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">{selectedProject.name}</h2>
            <p className="mb-4 text-gray-600">
              Owner: {selectedProject.owner === localStorage.getItem('userId') ? 'You' : 'Another user'}
              {' | Collaborators: '}
              {selectedProject.collaborators && Array.isArray(selectedProject.collaborators)
                ? selectedProject.collaborators.map((id) => String(id).slice(-4)).join(', ')
                : 'None'}
            </p>
            <CodeEditor
              projectId={selectedProject._id}
              fileName="index.js"
              socket={socketRef.current}
            />
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-blue-700">Meetings</h3>
              {meetings.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {meetings.map((meeting) => (
                    <li key={meeting._id} className="p-2 bg-gray-50 rounded-md">
                      {new Date(meeting.startTime).toLocaleString()} -{' '}
                      {new Date(meeting.endTime).toLocaleString()}{' '}
                      <a href={meeting.meetingLink} className="text-blue-500 hover:underline">
                        Join
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No meetings scheduled.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-gray-400">No projects available. Create one to start!</p>
          </div>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default ProjectDashboard;