import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProjectDashboard from './components/ProjectDashboard';
import Meeting from './pages/Meeting';
import Home from './pages/Home';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/projects" element={<ProjectDashboard />} />
        <Route path="/meeting/:meetingId" element={<Meeting />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;