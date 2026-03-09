import { useState, useEffect, useRef } from 'react'

export default function PlayerSwap({ player, adminData, onChange }) {
    const [showSearch, setShowSearch] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        if (!showSearch) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setShowSearch(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showSearch])

    const results = (() => {
        if (!showSearch || !adminData) return []
        const q = query.trim().toLowerCase()
        if (q.length < 2) return []
        const out = []
        const seen = new Set()

        for (const p of (adminData.players || [])) {
            if (seen.has(p.league_player_id)) continue
            if (p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                out.push(p)
            }
        }
        return out.slice(0, 12)
    })()

    return (
        <div className="relative" ref={containerRef}>
            {showSearch ? (
                <input ref={inputRef} type="text" value={query} autoFocus
                       onChange={e => setQuery(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Escape') setShowSearch(false) }}
                       className="bg-transparent border-b border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)]"
                       placeholder="Search player..." />
            ) : (
                <button onClick={() => { setShowSearch(true); setQuery('') }}
                        className="text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors text-left w-full truncate">
                    {player.player_name}
                </button>
            )}

            {showSearch && results.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded shadow-xl max-h-48 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {results.map((r, i) => (
                        <button key={`${r.league_player_id}_${i}`}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    onChange({
                                        player_name: r.name,
                                        player_id: r.player_id,
                                        league_player_id: r.league_player_id,
                                    })
                                    setShowSearch(false)
                                }}>
                            {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                            <span>{r.name}</span>
                            {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role === 'Sub' ? 'Rule 0-Sub' : r.role}</span>}
                            {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
