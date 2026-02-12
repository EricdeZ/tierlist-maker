// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false, requiredPermission = null }) {
    const { user, loading, isAdmin, hasPermission, hasAnyPermission, permissions } = useAuth()

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

    // Specific permission check — allow if user has it globally or for any league
    if (requiredPermission) {
        const hasGlobal = hasPermission(requiredPermission)
        const hasForAnyLeague = Object.values(permissions.byLeague).some(
            perms => perms.includes(requiredPermission)
        )
        if (!hasGlobal && !hasForAnyLeague) {
            return <Navigate to="/admin" replace />
        }
    }

    // General admin check: legacy admin role OR any RBAC permission
    if (requireAdmin && !isAdmin && !hasAnyPermission) {
        return <Navigate to="/" replace />
    }

    return children
}
