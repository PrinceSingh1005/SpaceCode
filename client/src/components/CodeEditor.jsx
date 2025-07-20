import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';
import axios from 'axios';
import debounce from 'lodash/debounce';

const CodeEditor = ({ projectId, fileName }) => {
  const [code, setCode] = useState('// Start coding here');
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [lastSavedCode, setLastSavedCode] = useState('// Start coding here');
  const [saveStatus, setSaveStatus] = useState('');
  const socket = useRef(null);
  const editorRef = useRef(null);
  const userId = localStorage.getItem('userId');
  const lastCodeRef = useRef(code);
  const cursorPositionRef = useRef({ row: 0, column: 0 }); // Track local cursor position

  const handleCodeChange = useCallback(
    debounce((newCode) => {
      if (newCode !== lastCodeRef.current) {
        setCode(newCode);
        console.log('Emitting code change for project:', projectId, 'file:', fileName, 'content:', newCode, 'userId:', userId);
        socket.current.emit('codeChange', { projectId, fileName, content: newCode, senderId: userId });
        lastCodeRef.current = newCode;
      }
    }, 300),
    [projectId, fileName, userId]
  );

  const handleCursorChange = useCallback((selection) => {
    const cursor = selection.getCursor();
    cursorPositionRef.current = cursor; // Update local cursor position
    const lastPosition = cursors[userId] || { row: -1, column: -1 };
    if (cursor.row !== lastPosition.row || cursor.column !== lastPosition.column) {
      console.log('Emitting cursor move for user:', userId, 'position:', cursor);
      socket.current.emit('cursorMove', { projectId, userId, position: cursor });
    }
  }, [projectId, userId, cursors]);

  const handleSave = async () => {
    try {
      setSaveStatus('Saving...');
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/projects/${projectId}/files/${fileName}`,
        { content: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLastSavedCode(code);
      setSaveStatus('Saved!');
      console.log('Code saved:', { projectId, fileName, lastModified: response.data.lastModified });

      // Sync saved state to all clients
      socket.current.emit('codeChange', { projectId, fileName, content: code, senderId: userId, isSaved: true });

      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('Save failed!');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  useEffect(() => {
    socket.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message, { stack: error.stack });
    });

    console.log('Attempting to join room:', projectId);
    socket.current.emit('joinRoom', projectId);

    socket.current.on('codeChange', ({ fileName: receivedFileName, content, senderId, isSaved }) => {
      if (receivedFileName === fileName && senderId !== userId) {
        console.log('Received code update for file:', receivedFileName, 'content:', content, 'from:', senderId, 'isSaved:', isSaved, 'localUserId:', userId);
        const currentCursor = { ...cursorPositionRef.current }; // Capture current cursor
        if (content !== code) { // Only update if content differs
          setCode(content);
          if (editorRef.current) {
            const session = editorRef.current.editor.getSession();
            session.setValue(content); // Update session directly
            editorRef.current.editor.moveCursorToPosition(currentCursor); // Restore cursor
          }
        }
        if (isSaved) {
          setLastSavedCode(content);
        }
      }
    });

    socket.current.on('userJoined', (joinedUserId) => {
      console.log('User joined:', joinedUserId);
      setUsers((prev) => [...new Set([...prev, joinedUserId])]);
    });

    socket.current.on('userDisconnected', (disconnectedUserId) => {
      console.log('User disconnected:', disconnectedUserId);
      setUsers((prev) => prev.filter((id) => id !== disconnectedUserId));
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[disconnectedUserId];
        return newCursors;
      });
    });

    socket.current.on('cursorMove', ({ userId: movedUserId, position }) => {
      if (movedUserId !== userId) {
        console.log(`Received cursor move from user ${movedUserId}:`, position);
        setCursors((prev) => ({
          ...prev,
          [movedUserId]: position,
        }));
      }
    });

    const fetchInitialCode = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(
          `http://localhost:5000/api/projects/${projectId}/files/${fileName}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const initialCode = data.content || '// Start coding here';
        setCode(initialCode);
        setLastSavedCode(initialCode);
        if (editorRef.current) {
          editorRef.current.editor.getSession().setValue(initialCode); // Use session for initial load
          editorRef.current.editor.moveCursorToPosition({ row: 0, column: 0 }); // Start at beginning
        }
        lastCodeRef.current = initialCode;
      } catch (err) {
        console.error('Fetch initial code error:', err);
      }
    };
    fetchInitialCode();

    return () => {
      console.log('Leaving room:', projectId);
      socket.current.emit('leaveRoom', projectId);
      socket.current.disconnect();
    };
  }, [projectId, fileName, userId]);

  const cursorMarkers = Object.entries(cursors).map(([userId, position]) => ({
    startRow: position.row,
    startCol: position.column,
    endRow: position.row,
    endCol: position.column + 1,
    className: `cursor-${userId.slice(-4)}`,
    type: 'text',
  }));

  const getColorForUser = (userId) => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    const index = parseInt(userId.slice(-4), 16) % colors.length;
    return colors[index];
  };

  const cursorStyles = Object.keys(cursors)
    .map(
      (userId) => `
        .cursor-${userId.slice(-4)} {
          position: absolute;
          background: ${getColorForUser(userId)};
          width: 2px;
          height: 1.2em;
        }
        .cursor-${userId.slice(-4)}:after {
          content: '${userId.slice(-4)}';
          position: absolute;
          top: -20px;
          left: 0;
          color: ${getColorForUser(userId)};
          font-size: 12px;
          font-weight: bold;
        }
      `
    )
    .join('');

  return (
    <div className="p-4 bg-gray-800 text-white rounded-md">
      <style>{cursorStyles}</style>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">{fileName}</h3>
        <button
          onClick={handleSave}
          className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
          disabled={code === lastSavedCode}
        >
          Save
        </button>
      </div>
      <p className="mb-2">Connected Users: {users.length || 0}</p>
      {saveStatus && <p className="text-yellow-400 mb-2">{saveStatus}</p>}
      <AceEditor
        mode="javascript"
        theme="monokai"
        value={code}
        onChange={handleCodeChange}
        onCursorChange={handleCursorChange}
        name="code-editor"
        width="100%"
        height="400px"
        fontSize={14}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={true}
        editorProps={{ $blockScrolling: true }}
        markers={cursorMarkers}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
        ref={editorRef}
      />
    </div>
  );
};

export default CodeEditor;