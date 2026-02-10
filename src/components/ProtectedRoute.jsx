// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, loading, isAdmin } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Checking authentication...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/?login=required" replace />
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />
    }

    return children
}
