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
  const [saveStatus, setSaveStatus] = useState('');
  const socket = useRef(null);
  const editorRef = useRef(null);
  const userId = localStorage.getItem('userId');
  const lastCodeRef = useRef(code);
  const isUpdatingRef = useRef(false);
  const isFocusedRef = useRef(false); // Track editor focus state

  const handleCodeChange = useCallback(
    debounce((newCode) => {
      if (newCode !== lastCodeRef.current && !isUpdatingRef.current) {
        setCode(newCode);
        console.log('Emitting code change for project:', projectId, 'file:', fileName, 'content:', newCode);
        socket.current.emit('codeChange', { projectId, fileName, content: newCode });
        lastCodeRef.current = newCode;
        saveToDatabase(newCode);
      }
    }, 300),
    [projectId, fileName]
  );

  const saveToDatabase = useCallback(
    debounce(async (newCode) => {
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `http://localhost:5000/api/projects/${projectId}/files/${fileName}`,
          { content: newCode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSaveStatus('Saved successfully!');
        setTimeout(() => setSaveStatus(''), 2000);
        console.log('Code saved to database:', { projectId, fileName });
      } catch (err) {
        setSaveStatus('Save failed!');
        console.error('Save to database error:', err.response?.data || err.message);
        setTimeout(() => setSaveStatus(''), 2000);
      }
    }, 1000),
    [projectId, fileName]
  );

  const handleCursorChange = useCallback(
    debounce((selection) => {
      if (!isFocusedRef.current) return; // Ignore if not focused
      const cursor = selection.getCursor();
      const lastPosition = cursors[userId] || { row: -1, column: -1 };
      if (!isUpdatingRef.current && (cursor.row !== lastPosition.row || cursor.column !== lastPosition.column)) {
        console.log('Emitting cursor move for user:', userId, 'position:', cursor);
        socket.current.emit('cursorMove', { projectId, userId, position: cursor });
      }
    }, 100), // Increased debounce to 100ms to reduce frequency
    [projectId, userId, cursors]
  );

  useEffect(() => {
    socket.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message, { stack: error.stack });
    });

    console.log('Attempting to join room:', projectId);
    socket.current.emit('joinRoom', projectId);

    socket.current.on('codeChange', ({ fileName: receivedFileName, content, senderId }) => {
      if (receivedFileName === fileName && senderId !== userId) {
        console.log('Received code update for file:', receivedFileName, 'content:', content, 'from:', senderId);
        isUpdatingRef.current = true;
        setCode(content);
        if (editorRef.current) {
          const editor = editorRef.current.editor;
          const cursor = editor.getCursorPosition();
          editor.setValue(content, -1);
          editor.moveCursorToPosition(cursor);
        }
        isUpdatingRef.current = false;
      }
    });

    socket.current.on('userJoined', (joinedUserId) => {
      console.log('User joined:', joinedUserId);
      setUsers((prev) => [...new Set([...prev, joinedUserId])]);
      setSaveStatus(`${joinedUserId.slice(-4)} joined the collaboration!`);
      setTimeout(() => setSaveStatus(''), 2000);
    });

    socket.current.on('userDisconnected', (disconnectedUserId) => {
      console.log('User disconnected:', disconnectedUserId);
      setUsers((prev) => prev.filter((id) => id !== disconnectedUserId));
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[disconnectedUserId];
        return newCursors;
      });
      setSaveStatus(`${disconnectedUserId.slice(-4)} left the collaboration!`);
      setTimeout(() => setSaveStatus(''), 2000);
    });

    socket.current.on('cursorMove', ({ userId: movedUserId, position }) => {
      if (movedUserId !== userId) { // Only update for other users
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
        if (editorRef.current) {
          editorRef.current.editor.setValue(initialCode, -1);
        }
        lastCodeRef.current = initialCode;
      } catch (err) {
        console.error('Fetch initial code error:', err.response?.data || err.message);
      }
    };
    fetchInitialCode();

    return () => {
      console.log('Leaving room:', projectId);
      socket.current.emit('leaveRoom', projectId);
      socket.current.disconnect();
    };
  }, [projectId, fileName]);

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

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded-md">
      <style>{cursorStyles}</style>
      <h3 className="text-lg font-semibold mb-2">{fileName}</h3>
      <p className="mb-2">Connected Users: {users.length || 0}</p>
      {saveStatus && (
        <div className="p-2 mb-2 bg-green-600 text-white rounded-md text-sm">
          {saveStatus}
        </div>
      )}
      <AceEditor
        mode="javascript"
        theme="monokai"
        value={code}
        onChange={handleCodeChange}
        onCursorChange={handleCursorChange}
        onFocus={handleFocus} // Track focus
        onBlur={handleBlur}   // Track blur
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