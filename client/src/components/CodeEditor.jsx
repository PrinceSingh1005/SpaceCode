import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';
import axios from 'axios';
import debounce from 'lodash/debounce';

function decodeJwt(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

const CodeEditor = ({ projectId, fileName }) => {
  const [code, setCode] = useState('// Your code starts here...');
  const [collaborators, setCollaborators] = useState({});
  const [cursors, setCursors] = useState({});
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const socket = useRef(null);
  const editorRef = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const decoded = decodeJwt(token);
    if (decoded) {
      setUserId(decoded.id);
      setUsername(decoded.username);
    }
  }, []);

  const debouncedEmit = useCallback(
    debounce((newCode, senderId) => {
      socket.current.emit('codeChange', { projectId, fileName, content: newCode, senderId });
    }, 250),
    [projectId, fileName]
  );

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    codeRef.current = newCode;
    setSaveStatus('Unsaved');
    if (userId) {
      debouncedEmit(newCode, userId);
    }
  };

  const handleCursorChange = useCallback(
    debounce((selection) => {
      const position = selection.getCursor();
      if (userId && username) {
        socket.current.emit('cursorMove', { projectId, userId, username, position });
      }
    }, 50),
    [projectId, userId, username]
  );

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/projects/${projectId}/files/${fileName}`,
        { content: codeRef.current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('Save Failed!');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  useEffect(() => {
    if (!userId) return;

    socket.current = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    socket.current.emit('joinRoom', { projectId, username });

    socket.current.on('initialState', (initialCollaborators) => {
      setCollaborators(initialCollaborators);
    });

    socket.current.on('codeChange', ({ content, senderId }) => {
      if (senderId !== userId) {
        const cursorPosition = editorRef.current.editor.getCursorPosition();
        setCode(content);
        editorRef.current.editor.moveCursorToPosition(cursorPosition);
      }
    });

    socket.current.on('userJoined', ({ id, username: joinedUsername }) => {
      if (id !== userId) {
        setCollaborators((prev) => ({ ...prev, [id]: { username: joinedUsername } }));
      }
    });

    socket.current.on('userLeft', (leftUserId) => {
      setCollaborators((prev) => {
        const newCollaborators = { ...prev };
        delete newCollaborators[leftUserId];
        return newCollaborators;
      });
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[leftUserId];
        return newCursors;
      });
    });

    socket.current.on('cursorMove', ({ userId: movedUserId, username: movedUsername, position }) => {
      if (movedUserId !== userId) {
        setCursors((prev) => ({
          ...prev,
          [movedUserId]: { position, username: movedUsername },
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
        const initialCode = data.content || '// Your code starts here...';
        setCode(initialCode);
        codeRef.current = initialCode;
      } catch (err) {
        console.error('Failed to fetch initial code:', err);
      }
    };

    fetchInitialCode();

    return () => {
      socket.current.emit('leaveRoom', { projectId, userId });
      socket.current.disconnect();
    };
  }, [projectId, fileName, userId, username]);

  const getColorForUser = (id) => {
    const colors = ['#FF8C00', '#00BFFF', '#ADFF2F', '#FF69B4', '#7B68EE', '#32CD32'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const cursorMarkers = Object.entries(cursors).map(([id, { position }]) => ({
    startRow: position.row,
    startCol: position.column,
    endRow: position.row,
    endCol: position.column + 1,
    className: `cursor-marker-${id}`,
    type: 'text',
  }));

  const cursorStyles = Object.entries(cursors)
    .map(
      ([id, { username: cursorUsername }]) => {
        const color = getColorForUser(id);
        return `
          .cursor-marker-${id} {
            position: absolute;
            background: ${color};
            width: 2px !important;
            z-index: 20;
          }
          .ace_cursor-layer .cursor-marker-${id}::after {
            content: '${cursorUsername}';
            position: absolute;
            left: -2px;
            top: -1.4em;
            padding: 2px 4px;
            background: ${color};
            color: white;
            border-radius: 3px;
            font-size: 12px;
            white-space: nowrap;
          }
        `;
      }
    )
    .join('');

  return (
    <div className="relative bg-[#272822] rounded-md shadow-lg">
      <style>{cursorStyles}</style>
      <div className="flex justify-between items-center p-3 bg-gray-700 rounded-t-md">
        <h3 className="text-lg font-semibold text-gray-200">{fileName}</h3>
        <div className="flex items-center space-x-4">
          <span className={`text-sm font-medium ${saveStatus === 'Saved' ? 'text-green-400' : 'text-yellow-400'}`}>
            {saveStatus}
          </span>
          <button
            onClick={handleSave}
            className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 disabled:bg-gray-500 transition-colors"
            disabled={saveStatus !== 'Unsaved'}
          >
            Save
          </button>
        </div>
      </div>
      <AceEditor
        ref={editorRef}
        mode="javascript"
        theme="monokai"
        value={code}
        onChange={handleCodeChange}
        onCursorChange={handleCursorChange}
        name={`code-editor-${projectId}`}
        width="100%"
        height="500px"
        fontSize={16}
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
      />
      <div className="absolute top-3 right-48 flex items-center space-x-2">
        {Object.entries(collaborators).map(([id, { username: collaboratorUsername }]) => (
          <div key={id} className="flex items-center" title={collaboratorUsername}>
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getColorForUser(id) }}
            ></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeEditor;