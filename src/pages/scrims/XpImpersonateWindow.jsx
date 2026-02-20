import { useState, useEffect, useRef } from 'react'
import { scrimService } from '../../services/database'

export default function XpImpersonateWindow({ impersonatedUser, onImpersonate, onClear }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const debounceRef = useRef(null)

    useEffect(() => {
        if (!searchQuery.trim()) { setResults([]); return }
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            setSearching(true)
            try {
                const data = await scrimService.searchUsers(searchQuery.trim())
                setResults(data.users || [])
            } catch { setResults([]) }
            finally { setSearching(false) }
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [searchQuery])

    return (
        <div style={{ padding: 6 }}>
            {impersonatedUser && (
                <div className="flex items-center gap-2 mb-2 p-1.5" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 2 }}>
                    <span style={{ fontSize: 14 }}>&#128373;</span>
                    <div className="flex-1 min-w-0">
                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 11 }}>Acting as: {impersonatedUser.discordUsername}</div>
                        <div className="xp-text" style={{ fontSize: 9, color: '#666' }}>ID: {impersonatedUser.id}</div>
                    </div>
                    <button onClick={onClear} className="xp-btn xp-btn-danger" style={{ padding: '1px 8px', fontSize: 10 }}>
                        Stop
                    </button>
                </div>
            )}

            <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search user by Discord name..."
                className="xp-input w-full"
                style={{ fontSize: 11, marginBottom: 4 }}
            />

            {searching && <div className="xp-text" style={{ fontSize: 10, color: '#888', textAlign: 'center' }}>Searching...</div>}

            {!searching && results.length > 0 && (
                <div className="xp-listbox" style={{ maxHeight: 160, overflowY: 'auto' }}>
                    {results.map(u => (
                        <button key={u.id} onClick={() => {
                            onImpersonate(u)
                            setSearchQuery('')
                            setResults([])
                        }} className="xp-listbox-item" style={{
                            background: impersonatedUser?.id === u.id ? '#316ac5' : undefined,
                            color: impersonatedUser?.id === u.id ? '#fff' : undefined,
                        }}>
                            <span className="xp-text" style={{ fontSize: 11 }}>{u.discordUsername}</span>
                            <span className="xp-text" style={{ fontSize: 9, color: impersonatedUser?.id === u.id ? '#ccc' : '#888', marginLeft: 'auto' }}>#{u.id}</span>
                        </button>
                    ))}
                </div>
            )}

            {!searching && searchQuery && results.length === 0 && (
                <div className="xp-text" style={{ fontSize: 10, color: '#888', textAlign: 'center', padding: '4px 0' }}>No users found</div>
            )}

            {!impersonatedUser && !searchQuery && (
                <div className="xp-text" style={{ fontSize: 10, color: '#888', textAlign: 'center', padding: '8px 0' }}>
                    Search for a user to act as them.
                </div>
            )}
        </div>
    )
}
