// src/pages/admin/roster/RoleBadge.jsx
import { useState, useEffect, useRef } from 'react'
import { ROLES, ROLE_COLORS } from './constants'

export function RoleBadge({ role, leaguePlayerId, playerName, onRoleChange }) {
    const [editing, setEditing] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!editing) return
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setEditing(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editing])

    const roleLower = (role || 'fill').toLowerCase()
    const colorClass = ROLE_COLORS[roleLower] || ROLE_COLORS.fill

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setEditing(!editing)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 transition-opacity hover:opacity-80 ${colorClass}`}
                title="Click to change role"
            >
                {role || 'Fill'}
            </button>

            {editing && (
                <div
                    className="absolute right-0 top-full mt-1 z-40 w-32 rounded-lg border shadow-xl overflow-hidden"
                    style={{
                        backgroundColor: 'var(--color-primary)',
                        borderColor: 'rgba(255,255,255,0.1)',
                    }}
                >
                    {ROLES.map(r => (
                        <button
                            key={r}
                            onClick={() => {
                                setEditing(false)
                                if (r.toLowerCase() !== roleLower) {
                                    onRoleChange(leaguePlayerId, playerName, r)
                                }
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                                r.toLowerCase() === roleLower
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5'
                            }`}
                        >
                            <span>{r}</span>
                            {r.toLowerCase() === roleLower && <span>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
