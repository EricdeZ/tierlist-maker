import { useState, useEffect, useRef } from 'react'
import BaseModal, { ModalHeader } from '../../../components/BaseModal'

export function MergeModal({ globalPlayers, onClose, onMerge, opLoading }) {
    const [sourceQuery, setSourceQuery] = useState('')
    const [targetQuery, setTargetQuery] = useState('')
    const [sourcePlayer, setSourcePlayer] = useState(null)
    const [targetPlayer, setTargetPlayer] = useState(null)
    const [showSourceDropdown, setShowSourceDropdown] = useState(false)
    const [showTargetDropdown, setShowTargetDropdown] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const sourceRef = useRef(null)
    const targetRef = useRef(null)

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    // Click-outside handlers
    useEffect(() => {
        const handler = (e) => {
            if (sourceRef.current && !sourceRef.current.contains(e.target)) setShowSourceDropdown(false)
            if (targetRef.current && !targetRef.current.contains(e.target)) setShowTargetDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filterPlayers = (query, excludeId) => {
        const q = query.trim().toLowerCase()
        if (q.length < 2) return []
        return globalPlayers
            .filter(p => p.name.toLowerCase().includes(q) && (!excludeId || p.player_id !== excludeId))
            .slice(0, 10)
    }

    const sourceResults = filterPlayers(sourceQuery, targetPlayer?.player_id)
    const targetResults = filterPlayers(targetQuery, sourcePlayer?.player_id)

    const handleMerge = async () => {
        if (!sourcePlayer || !targetPlayer) return
        try {
            await onMerge(sourcePlayer.player_id, targetPlayer.player_id)
        } catch {
            // Error shown via toast
        }
    }

    return (
        <BaseModal onClose={onClose}>
            <ModalHeader title="Merge Players" subtitle="Merge a duplicate player's stats into the real player" onClose={onClose} />

            <div className="px-5 py-4 space-y-4">
                {/* Source player (duplicate) */}
                <div ref={sourceRef} className="relative">
                    <label className="block text-xs font-medium text-red-400 mb-1">
                        Duplicate Player (will be deleted)
                    </label>
                    {sourcePlayer ? (
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            <span className="text-sm text-[var(--color-text)]">{sourcePlayer.name}</span>
                            <button onClick={() => { setSourcePlayer(null); setSourceQuery(''); setConfirmed(false) }}
                                    className="text-xs text-red-400 hover:text-red-300">✕</button>
                        </div>
                    ) : (
                        <>
                            <input
                                type="text"
                                value={sourceQuery}
                                onChange={e => { setSourceQuery(e.target.value); setShowSourceDropdown(true); setConfirmed(false) }}
                                onFocus={() => setShowSourceDropdown(true)}
                                placeholder="Search duplicate player..."
                                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            />
                            {showSourceDropdown && sourceResults.length > 0 && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-40 overflow-y-auto"
                                     style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                    {sourceResults.map(p => (
                                        <button key={p.player_id}
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setSourcePlayer(p); setShowSourceDropdown(false); setSourceQuery('') }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors">
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Arrow */}
                <div className="text-center text-[var(--color-text-secondary)] text-lg">↓ merge into ↓</div>

                {/* Target player (real) */}
                <div ref={targetRef} className="relative">
                    <label className="block text-xs font-medium text-green-400 mb-1">
                        Real Player (will keep)
                    </label>
                    {targetPlayer ? (
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                            <span className="text-sm text-[var(--color-text)]">{targetPlayer.name}</span>
                            <button onClick={() => { setTargetPlayer(null); setTargetQuery(''); setConfirmed(false) }}
                                    className="text-xs text-green-400 hover:text-green-300">✕</button>
                        </div>
                    ) : (
                        <>
                            <input
                                type="text"
                                value={targetQuery}
                                onChange={e => { setTargetQuery(e.target.value); setShowTargetDropdown(true); setConfirmed(false) }}
                                onFocus={() => setShowTargetDropdown(true)}
                                placeholder="Search real player..."
                                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-green-500/50"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            />
                            {showTargetDropdown && targetResults.length > 0 && (
                                <div className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-40 overflow-y-auto"
                                     style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                    {targetResults.map(p => (
                                        <button key={p.player_id}
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setTargetPlayer(p); setShowTargetDropdown(false); setTargetQuery('') }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors">
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Summary & confirm */}
                {sourcePlayer && targetPlayer && (
                    <div className="border-t border-white/10 pt-3 space-y-3">
                        <div className="text-xs text-[var(--color-text-secondary)] bg-white/5 rounded-lg px-3 py-2">
                            <strong className="text-red-400">{sourcePlayer.name}</strong> will be deleted.
                            All their stats will be moved to <strong className="text-green-400">{targetPlayer.name}</strong>.
                            <br /><span className="text-[10px]">"{sourcePlayer.name}" will be saved as an alias.</span>
                        </div>

                        {!confirmed ? (
                            <button
                                onClick={() => setConfirmed(true)}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-yellow-600 text-white hover:bg-yellow-500 transition-colors"
                            >
                                Confirm Merge
                            </button>
                        ) : (
                            <button
                                onClick={handleMerge}
                                disabled={isAnyLoading}
                                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                            >
                                {isAnyLoading ? 'Merging...' : 'Yes, Merge & Delete Duplicate'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
