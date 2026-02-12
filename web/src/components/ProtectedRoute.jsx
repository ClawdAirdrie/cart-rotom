
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requirePayment = false }) {
    const { currentUser, isPaying, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-white/10 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (requirePayment && !isPaying) {
        return <Navigate to="/upgrade" replace />;
    }

    return children;
}
