import { useState, useEffect, useRef } from 'react'

export default function GodAutocomplete({ value, gods, onChange }) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        if (!showDropdown) return
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showDropdown])

    const filtered = (() => {
        if (!showDropdown || !gods?.length) return []
        const q = query.trim().toLowerCase()
        if (!q) return gods
        return gods.filter(g => g.name.toLowerCase().includes(q))
    })()

    const currentGod = gods?.find(g => g.name.toLowerCase() === (value || '').toLowerCase())

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-1">
                {currentGod?.image_url && !showDropdown && (
                    <img src={currentGod.image_url} alt="" className="w-4 h-4 rounded-sm shrink-0 object-cover" />
                )}
                <input ref={inputRef} type="text"
                       value={showDropdown ? query : (value || '')}
                       onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                       onFocus={() => { setQuery(value || ''); setShowDropdown(true) }}
                       onKeyDown={e => {
                           if (e.key === 'Escape') { setShowDropdown(false); inputRef.current?.blur() }
                           if (e.key === 'Tab') setShowDropdown(false)
                       }}
                       className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors" />
            </div>

            {showDropdown && filtered.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-56 border rounded shadow-xl max-h-56 overflow-y-auto"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    {query === '' && (
                        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                            All gods — type to filter
                        </div>
                    )}
                    {filtered.map(god => (
                        <button key={god.id}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    onChange({ god_played: god.name })
                                    setShowDropdown(false)
                                    setQuery('')
                                }}>
                            {god.image_url && <img src={god.image_url} alt="" className="w-5 h-5 rounded-sm shrink-0 object-cover" />}
                            <span className="text-[var(--color-text)]">{god.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {showDropdown && query.length >= 2 && filtered.length === 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-48 border rounded shadow-lg px-3 py-2 text-[10px] text-[var(--color-text-secondary)]"
                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                    No gods found for "{query}"
                </div>
            )}
        </div>
    )
}
