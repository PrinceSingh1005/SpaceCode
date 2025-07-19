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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    socketRef.current.on('projectUpdate', (updatedProject) => {
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
      if (selectedProject?._id === projectId) {
        setSelectedProject((prev) => ({
          ...prev,
          files: prev.files.map((file) =>
            file.name === 'index.js' ? { ...file, content: code } : file
          ),
        }));
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [selectedProject?._id]);

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
          setMeetings([]);
          setError('Failed to load meetings. Please try again.');
        }
      }
    };

    fetchData();
    fetchMeetings();
  }, [selectedProject?._id]);

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
      socketRef.current.emit('projectUpdate', data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project) => {
    if (!project._id) return;
    setSelectedProject(project);
    setError('');
    setIsMobileMenuOpen(false);
    const fetchMeetings = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(
          `http://localhost:5000/api/meetings/project/${project._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMeetings(data);
      } catch (err) {
        setMeetings([]);
        setError('Failed to load meetings. Please try again.');
      }
    };
    fetchMeetings();
  };

  const renderSidebarContent = () => (
    <>
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
      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {projects.map((project) => (
          <div
            key={project._id}
            className={`p-3 cursor-pointer rounded-md shadow-sm ${
              selectedProject?._id === project._id
                ? 'bg-blue-100'
                : 'bg-white hover:bg-gray-100'
            }`}
            onClick={() => handleProjectSelect(project)}
          >
            <h3 className="font-medium">{project.name}</h3>
            <p className="text-sm text-gray-500">
              {project.collaborators?.length ?? 0} collaborators
            </p>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="relative flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-800 overflow-hidden">
      <button
        onClick={() => setIsColabOpen(!isColabOpen)}
        className="absolute top-4 right-4 z-30 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
      >
        Colab
      </button>

      {isColabOpen && (
        <div className="absolute top-16 right-4 z-40 w-11/12 sm:w-96 bg-white rounded-lg shadow-xl p-5 transition-all">
          <CollaborationPanel projects={projects} onUpdate={() => {}} />
        </div>
      )}

      <div className="lg:hidden fixed left-4 top-4 z-40">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-white shadow rounded-md text-gray-700 hover:text-blue-600"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <div
        className={`fixed inset-0 bg-black bg-opacity-40 z-30 transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-40 w-72 h-full bg-white p-6 shadow-lg transition-transform duration-300 ease-in-out transform lg:hidden
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-blue-700">Your Projects</h2>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-gray-500 hover:text-red-500"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden lg:block lg:w-1/4 p-6 bg-white shadow-lg border-r border-gray-200 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-blue-700">Your Projects</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {renderSidebarContent()}
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {selectedProject ? (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">{selectedProject.name}</h2>
            <p className="mb-4 text-gray-600">
              Owner: {selectedProject.owner === localStorage.getItem('userId') ? 'You' : 'Another user'} |
              Collaborators: {selectedProject.collaborators?.map((id) => String(id).slice(-4)).join(', ') || 'None'}
            </p>
            <CodeEditor projectId={selectedProject._id} fileName="index.js" socket={socketRef.current} />
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-blue-700">Meetings</h3>
              {meetings.length > 0 ? (
                <ul className="space-y-2">
                  {meetings.map((meeting) => (
                    <li key={meeting._id} className="p-3 bg-gray-100 rounded-md">
                      {new Date(meeting.startTime).toLocaleString()} -{' '}
                      {new Date(meeting.endTime).toLocaleString()}{' '}
                      <a href={meeting.meetingLink} className="text-blue-500 hover:underline ml-2" target="_blank" rel="noreferrer">
                        Join
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No meetings scheduled.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500">
            No project selected. Choose or create a project to get started.
          </div>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </main>
    </div>
  );
};

export default ProjectDashboard;