import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, role, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="text-center p-4">Loading authentication...</div>;
    }

    // Redirect authenticated users from /login or /register to /projects
    if (user && (location.pathname === '/login' || location.pathname === '/register')) {
        return <Navigate to="/projects" replace />;
    }

    // Check if the route requires authentication and user is not logged in
    if (!user && (location.pathname === '/projects' || location.pathname.startsWith('/meeting/'))) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Check role-based access if specified
    if (allowedRoles && user && !allowedRoles.includes(role)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;