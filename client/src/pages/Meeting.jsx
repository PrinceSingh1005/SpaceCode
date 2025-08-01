import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CodeEditor from '../components/CodeEditor';

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const Meeting = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateMeeting = async () => {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        if (!token) {
          setError('Please log in to access the meeting');
          navigate('/login');
          return;
        }
        console.log('Fetching meeting with ID:', meetingId);
        console.log('User ID:', userId);
        console.log('Token:', token);
        const { data } = await axios.get(`${VITE_BACKEND_URL}/api/meetings/${meetingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Meeting data:', data);
        setMeeting(data);
        setError('');
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Failed to load meeting';
        console.error('Meeting fetch error:', err.response?.status, err.response?.data);
        setError(
          errorMessage +
            (err.response?.status === 403
              ? ' (You may not be a collaborator or the meeting is not active)'
              : err.response?.status === 404
              ? ' (Meeting not found)'
              : '')
        );
        // Only redirect after a delay to show the error
        setTimeout(() => navigate('/projects'), 3000);
      } finally {
        setLoading(false);
      }
    };
    validateMeeting();
  }, [meetingId, navigate]);

  return (
    <div className="flex h-screen">
      <div className="w-3/4 p-4">
        {loading && <p className="text-gray-600">Loading meeting...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {meeting && (
          <>
            <h2 className="text-xl font-bold mb-4">Meeting for Project: {meeting.projectId.name}</h2>
            <CodeEditor projectId={meeting.projectId._id} fileName="index.js" />
          </>
        )}
      </div>
      <div className="w-1/4 bg-gray-200 p-4">
        {meeting ? (
          <>
            <h3 className="text-lg font-semibold mb-2">Meeting Details</h3>
            <p>Start: {new Date(meeting.startTime).toLocaleString()}</p>
            <p>End: {new Date(meeting.endTime).toLocaleString()}</p>
            <p>Status: Active</p>
          </>
        ) : (
          !loading && !error && <p>No meeting data available.</p>
        )}
      </div>
    </div>
  );
};

export default Meeting;