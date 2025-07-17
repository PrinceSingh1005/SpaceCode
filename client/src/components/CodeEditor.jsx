import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';

const CodeEditor = ({ projectId, fileName }) => {
  const [code, setCode] = useState('// Start coding here');
  const [users, setUsers] = useState([]);
  const socket = useRef(null);

  useEffect(() => {
    // Connect to Socket.IO server
    socket.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    // Handle connection errors
    socket.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    // Join project room
    console.log('Joining project room:', projectId);
    socket.current.emit('join-room', projectId);

    // Listen for code updates
    socket.current.on('code-update', ({ fileName: receivedFileName, content }) => {
      if (receivedFileName === fileName) {
        console.log('Received code update:', content);
        setCode(content);
      }
    });

    // Listen for user events
    socket.current.on('user-joined', (userId) => {
      console.log('User joined:', userId);
      setUsers((prev) => [...new Set([...prev, userId])]);
    });

    socket.current.on('user-disconnected', (userId) => {
      console.log('User disconnected:', userId);
      setUsers((prev) => prev.filter((id) => id !== userId));
    });

    // Cleanup on unmount
    return () => {
      console.log('Leaving project room:', projectId);
      socket.current.emit('leave-room', projectId);
      socket.current.disconnect();
    };
  }, [projectId, fileName]);

  // Emit code changes
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    console.log('Emitting code update for project:', projectId, 'file:', fileName);
    socket.current.emit('code-update', { projectId, fileName, content: newCode });
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded-md">
      <h3 className="text-lg font-semibold mb-2">{fileName}</h3>
      <p className="mb-2">Connected Users: {users.length || 0}</p>
      <AceEditor
        mode="javascript"
        theme="monokai"
        value={code}
        onChange={handleCodeChange}
        name="code-editor"
        width="100%"
        height="400px"
        fontSize={14}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={true}
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
      />
    </div>
  );
};

export default CodeEditor;