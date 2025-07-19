import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper function to decode JWT payload
function decodeJwt(token) {
  if (!token) return {};
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const decoded = decodeJwt(storedToken);
          setUser(decoded?.id);
          setRole(decoded?.role || 'user');
          setToken(storedToken);
        } catch (err) {
          console.error('Token validation error:', err.message);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    try {
      const decoded = decodeJwt(newToken);
      setUser(decoded.id);
      setRole(decoded.role || 'user');
      setToken(newToken);
      navigate('/projects');
    } catch (err) {
      console.error('Login token error:', err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setRole(null);
    setToken(null);
    navigate('/login');
  };

  const value = {
    user,
    token,
    role,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;