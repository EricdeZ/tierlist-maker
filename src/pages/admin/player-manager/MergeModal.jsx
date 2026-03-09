import { useState, useRef, useEffect } from 'react'
import { Merge, AlertTriangle } from 'lucide-react'
import BaseModal from '../../../components/BaseModal'

export default function MergeModal({ players, onClose, onMerge, merging }) {
    const [sourceQuery, setSourceQuery] = useState('')
    const [targetQuery, setTargetQuery] = useState('')
    const [sourcePlayer, setSourcePlayer] = useState(null)
    const [targetPlayer, setTargetPlayer] = useState(null)
    const [showSourceDropdown, setShowSourceDropdown] = useState(false)
    const [showTargetDropdown, setShowTargetDropdown] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const sourceRef = useRef(null)
    const targetRef = useRef(null)

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
        return players
            .filter(p => {
                if (excludeId && p.id === excludeId) return false
                return p.name.toLowerCase().includes(q) ||
                    p.aliases.some(a => a.alias.toLowerCase().includes(q))
            })
            .slice(0, 10)
    }

    const sourceResults = filterPlayers(sourceQuery, targetPlayer?.id)
    const targetResults = filterPlayers(targetQuery, sourcePlayer?.id)

    const handleMerge = () => {
        if (!sourcePlayer || !targetPlayer) return
        onMerge(sourcePlayer.id, targetPlayer.id)
    }

    const renderSearchField = (config) => {
        const { label, labelColor, borderColor, bgColor, player, query, setQuery, setPlayer, showDropdown, setShowDropdown, results, fieldRef, focusColor } = config
        return (
            <div ref={fieldRef} className="relative">
                <label className={`block text-xs font-medium ${labelColor} mb-1`}>{label}</label>
                {player ? (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${bgColor} border ${borderColor}`}>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--color-text)]">{player.name}</span>
                            {player.aliases.length > 0 && (
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                    ({player.aliases.length} alias{player.aliases.length !== 1 ? 'es' : ''})
                                </span>
                            )}
                            {player.totalGames > 0 && (
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                    {player.totalGames}g
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => { setPlayer(null); setQuery(''); setConfirmed(false) }}
                            className={`text-xs ${labelColor} hover:opacity-75`}
                        >
                            {'\u2715'}
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setShowDropdown(true); setConfirmed(false) }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Search player name or alias..."
                            className={`w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-1 ${focusColor}`}
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        {showDropdown && results.length > 0 && (
                            <div
                                className="absolute z-50 top-full left-0 mt-1 w-full border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                                style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                {results.map(p => (
                                    <button
                                        key={p.id}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setPlayer(p); setShowDropdown(false); setQuery('') }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-white/5 transition-colors flex items-center justify-between"
                                    >
                                        <span>{p.name}</span>
                                        <span className="text-[var(--color-text-secondary)] text-[10px]">
                                            {p.totalGames}g · {p.seasonsPlayed}s
                                            {p.aliases.length > 0 && ` · ${p.aliases.length} alias`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    }

    return (
        <BaseModal onClose={onClose}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                            <Merge className="w-4 h-4" />
                            Merge Players
                        </h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                            Merge a duplicate player's stats and aliases into the real player
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">{'\u2715'}</button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {renderSearchField({
                        label: 'Duplicate Player (will be deleted)',
                        labelColor: 'text-red-400',
                        borderColor: 'border-red-500/20',
                        bgColor: 'bg-red-500/10',
                        focusColor: 'focus:ring-red-500/50',
                        player: sourcePlayer,
                        query: sourceQuery,
                        setQuery: setSourceQuery,
                        setPlayer: setSourcePlayer,
                        showDropdown: showSourceDropdown,
                        setShowDropdown: setShowSourceDropdown,
                        results: sourceResults,
                        fieldRef: sourceRef,
                    })}

                    <div className="text-center text-[var(--color-text-secondary)] text-lg">{'\u2193'} merge into {'\u2193'}</div>

                    {renderSearchField({
                        label: 'Real Player (will keep)',
                        labelColor: 'text-green-400',
                        borderColor: 'border-green-500/20',
                        bgColor: 'bg-green-500/10',
                        focusColor: 'focus:ring-green-500/50',
                        player: targetPlayer,
                        query: targetQuery,
                        setQuery: setTargetQuery,
                        setPlayer: setTargetPlayer,
                        showDropdown: showTargetDropdown,
                        setShowDropdown: setShowTargetDropdown,
                        results: targetResults,
                        fieldRef: targetRef,
                    })}

                    {/* Summary & confirm */}
                    {sourcePlayer && targetPlayer && (
                        <div className="border-t border-white/10 pt-3 space-y-3">
                            <div className="text-xs text-[var(--color-text-secondary)] bg-white/5 rounded-lg px-3 py-2 space-y-1">
                                <div>
                                    <strong className="text-red-400">{sourcePlayer.name}</strong> will be deleted.
                                    All their stats ({sourcePlayer.totalGames} games) will be moved to <strong className="text-green-400">{targetPlayer.name}</strong>.
                                </div>
                                <div className="text-[10px]">
                                    "{sourcePlayer.name}" will be saved as an alias.
                                    {sourcePlayer.aliases.length > 0 && ` ${sourcePlayer.aliases.length} existing alias${sourcePlayer.aliases.length !== 1 ? 'es' : ''} will also transfer.`}
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/5 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>This action cannot be undone. Make sure you have the right players selected.</span>
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
                                    disabled={merging}
                                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                                >
                                    {merging ? 'Merging...' : 'Yes, Merge & Delete Duplicate'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
        </BaseModal>
    )
}
