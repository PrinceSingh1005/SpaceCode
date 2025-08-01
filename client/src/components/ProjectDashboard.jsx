import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import CodeEditor from './CodeEditor';
import io from 'socket.io-client';
import CollaborationPanel from './CollaborationPanel';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function decodeJwt(token) {
  if (!token) return {};
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '${http://localhost:5000}';

const ProjectDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isColabOpen, setIsColabOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const socketRef = useRef(null);
  const colabPanelRef = useRef(null);
  const [userId, setUserId] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colabPanelRef.current && !colabPanelRef.current.contains(event.target)) {
        setIsColabOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColabOpen]);

  useEffect(() => {
    // This function will run when the component mounts to check the URL
    const attemptJoinFromLink = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const meetingId = queryParams.get('meetingId');

      if (meetingId) {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            // Or handle login redirection
            throw new Error('You must be logged in to join a meeting.');
          }

          // Your existing backend GET route for validating a meeting
          const { data: meetingData } = await axios.get(
            `${VITE_BACKEND_URL}/api/meetings/${meetingId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // The backend returns the project details on success
          const projectToJoin = projects.find(p => p._id === meetingData.projectId._id);
          
          if (projectToJoin) {
            setSelectedProject(projectToJoin);
            setNotification('Successfully joined scheduled session!');
            setTimeout(() => setNotification(''), 3000);
          } else {
            // This case might happen if the project list hasn't loaded yet
            // Or if the user isn't a member of that project.
            setError('Project not found in your list.');
          }

          // Clean the URL to remove the meetingId query parameter
          navigate('/projects', { replace: true });

        } catch (err) {
          setError(err.response?.data?.error || 'Failed to join via link. The session may not be active.');
        } finally {
          setLoading(false);
        }
      }
    };

    // We only run this if projects are loaded, to ensure we can select the project
    if (projects.length > 0) {
      attemptJoinFromLink();
    }
  }, [projects, navigate]);



  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = decodeJwt(token);
        setUserId(decoded?.id || '');
      } catch (err) {
        console.error('Token decoding error:', err.message);
        setError('Invalid authentication token');
      }
    }

    socketRef.current = io('${VITE_BACKEND_URL}', {
      auth: { token: localStorage.getItem('token') },
    });

    const handleProjectUpdate = (updatedProject) => {
      const fetchUpdatedProject = async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem('token');
          const { data } = await axios.get(
            `${VITE_BACKEND_URL}/api/projects/${updatedProject._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setProjects((prev) => {
            const existing = prev.find((p) => p._id === data._id);
            return existing ? prev.map((p) => (p._id === data._id ? data : p)) : [...prev, data];
          });
          if (selectedProject?._id === data._id) {
            setSelectedProject(data);
          }
        } catch (err) {
          console.error('Fetch updated project error:', err.response?.data || err.message);
          setError('Failed to update project data.');
        } finally {
          setLoading(false);
        }
      };
      fetchUpdatedProject();
    };

    const handleMeetingUpdate = (updatedMeeting) => {
      if (selectedProject?._id === updatedMeeting.projectId) {
        setMeetings((prev) => prev.map((m) => (m._id === updatedMeeting._id ? updatedMeeting : m)));
      }
    };

    const handleCodeChange = ({ projectId, code }) => {
      if (selectedProject?._id === projectId) {
        setSelectedProject((prev) => ({
          ...prev,
          files: prev.files.map((file) =>
            file.name === 'index.js' ? { ...file, content: code } : file
          ),
        }));
      }
    };

    socketRef.current.on('projectUpdate', handleProjectUpdate);
    socketRef.current.on('meetingUpdate', handleMeetingUpdate);
    socketRef.current.on('codeChange', handleCodeChange);
    socketRef.current.on('userJoined', (joinedUserId) => {
      setNotification(`${joinedUserId.slice(-4)} joined the collaboration!`);
      setTimeout(() => setNotification(''), 2000);
    });
    socketRef.current.on('userDisconnected', (disconnectedUserId) => {
      setNotification(`${disconnectedUserId.slice(-4)} left the collaboration!`);
      setTimeout(() => setNotification(''), 2000);
    });

    return () => {
      socketRef.current?.off('projectUpdate', handleProjectUpdate);
      socketRef.current?.off('meetingUpdate', handleMeetingUpdate);
      socketRef.current?.off('codeChange', handleCodeChange);
      socketRef.current?.disconnect();
    };
  }, [selectedProject?._id]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const { data } = await axios.get('${VITE_BACKEND_URL}/api/projects', {
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
          setLoading(true);
          const token = localStorage.getItem('token');
          const { data } = await axios.get(
            `${VITE_BACKEND_URL}/api/meetings/project/${selectedProject._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setMeetings(data);
        } catch (err) {
          console.error('Fetch meetings error:', err.response?.data || err.message);
          setMeetings([]);
          setError('Failed to load meetings. Please try again.');
        } finally {
          setLoading(false);
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
        '${VITE_BACKEND_URL}/api/projects',
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

  const onUpdate = (newProject) => {
    if (newProject) {
      setProjects((prev) => [...prev, newProject]);
    } else {
      const fetchData = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const { data } = await axios.get('${VITE_BACKEND_URL}/api/projects', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setProjects(data);
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to fetch projects');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  };

  const leaveCollaboration = async () => {
    if (!selectedProject || !selectedProject._id) {
      setError('No project selected to leave');
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(
        `${VITE_BACKEND_URL}/api/projects/${selectedProject._id}/collaborators/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification('Left collaboration successfully!');
      setTimeout(() => {
        setNotification('');
        setSelectedProject(null);
        onUpdate();
      }, 2000);
      socketRef.current.emit('leaveRoom', selectedProject._id);
    } catch (err) {
      setError('Failed to leave collaboration');
      console.error('Leave collaboration error:', err.response?.data || err.message);
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
        setLoading(true);
        const token = localStorage.getItem('token');
        const { data } = await axios.get(
          `${VITE_BACKEND_URL}/api/meetings/project/${project._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMeetings(data);
      } catch (err) {
        console.error('Fetch meetings error:', err.response?.data || err.message);
        setMeetings([]);
        setError('Failed to load meetings. Please try again.');
      } finally {
        setLoading(false);
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
            className={`p-3 cursor-pointer rounded-md shadow-sm ${selectedProject?._id === project._id ? 'bg-blue-100' : 'bg-white hover:bg-gray-100'
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

  const isCollaborator =
    selectedProject &&
    (selectedProject.owner !== userId ||
      selectedProject.collaborators?.includes(userId));

  const ownerInfo = selectedProject?.collaborators?.find(
    (c) => c._id === selectedProject.owner
  );
  const ownerName = ownerInfo ? ownerInfo.username : 'Unknown';

  const collaboratorDisplay = selectedProject?.collaborators
    ?.filter((c) => c._id !== selectedProject.owner)
    ?.map((c) => c.username)
    ?.join(', ') || 'None';

  return (
    <div className="relative flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-800 overflow-hidden">
      {!isCollaborator ? (
        <button
          onClick={() => setIsColabOpen(!isColabOpen)}
          className="absolute top-4 right-10 z-30 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-opacity duration-300"
        >
          Invite for Colab
        </button>
      ) : (
        <button
          onClick={leaveCollaboration}
          className="absolute top-4 right-10 z-30 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 focus:outline-none transition-opacity duration-300"
          disabled={!selectedProject || selectedProject.owner === userId}
        >
          Leave Colab
        </button>
      )}
      {isColabOpen && (
        <div ref={colabPanelRef} className="absolute top-5 right-4 z-40 w-11/12 sm:w-96 bg-white rounded-lg shadow-xl p-5 transition-all duration-300">
          <CollaborationPanel projects={projects} onUpdate={onUpdate} />
        </div>
      )}

      <div className="lg:hidden fixed left-6 top-4 z-40">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-white shadow rounded-md text-gray-700 hover:text-blue-600 transition"
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
        className={`fixed inset-0 bg-black bg-opacity-40 z-30 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-40 w-72 h-full bg-white p-6 shadow-lg transition-transform duration-300 ease-in-out transform lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        style={{ paddingBottom: '72px' }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-blue-700">Your Projects</h2>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-gray-500 hover:text-red-500 transition"
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
        <button
          onClick={logout}
          className="absolute left-6 bottom-6 w-[calc(100%-3rem)] p-3 bg-gray-200 text-gray-700 rounded-md hover:bg-red-500 hover:text-white transition-colors"
        >
          Log Out
        </button>
      </aside>

      <aside className="hidden lg:block lg:w-1/4 p-6 bg-white shadow-lg border-r border-gray-200 overflow-y-auto relative" style={{ paddingBottom: '72px' }}>
        <h2 className="text-2xl font-bold mb-6 text-blue-700">Your Projects</h2>
        {loading && <p className="text-gray-500">Loading...</p>}
        {/* {error && <p className="text-red-500 mb-4">{error}</p>} */}
        {renderSidebarContent()}
        <button
          onClick={logout}
          className="absolute left-6 bottom-6 w-[calc(100%-3rem)] p-3 bg-gray-200 text-gray-700 rounded-md hover:bg-red-500 hover:text-white transition-colors"
        >
          Log Out
        </button>
      </aside>

      <main className="flex-1 mt-14 p-6 overflow-y-auto">
        {loading && !selectedProject && (
          <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500">
            Loading projects...
          </div>
        )}
        {selectedProject ? (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">{selectedProject.name}</h2>
            <p className="mb-4 text-gray-600">
              Owner: {ownerName} |
              Collaborators: {collaboratorDisplay}
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
        ) : !loading && (
          <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500">
            No project selected. Choose or create a project to get started.
          </div>
        )}
        {/* {error && <p className="text-red-500 mt-4">{error}</p>} */}
        {notification && (
          <div className="fixed top-4 left-4 p-2 bg-green-600 text-white rounded-md text-sm shadow-lg opacity-0 animate-fadeInOut z-50">
            {notification}
          </div>
        )}
      </main>
    </div>
  );
};

const styles = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  .animate-fadeInOut {
    animation: fadeInOut 2.5s ease-in-out forwards;
  }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default ProjectDashboard;
