import { ExternalLink, ChevronDown, ChevronRight, Tag, Trash2 } from 'lucide-react'

const roleColors = {
    solo: 'bg-orange-500/20 text-orange-400',
    jungle: 'bg-red-500/20 text-red-400',
    mid: 'bg-blue-500/20 text-blue-400',
    support: 'bg-green-500/20 text-green-400',
    adc: 'bg-purple-500/20 text-purple-400',
    sub: 'bg-gray-500/20 text-gray-400',
    fill: 'bg-gray-500/20 text-gray-400',
}

export default function PlayerRow({ player: p, isSelected, isExpanded, onToggleSelect, onToggleExpand, onEdit, onOpenAliases, onDelete }) {
    return (
        <>
            <tr className={`border-b border-white/5 transition-colors ${isSelected ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'}`}>
                <td className="px-3 py-2">
                    <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="rounded" />
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        <button onClick={onToggleExpand} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                            {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                            }
                        </button>
                        {p.current ? (
                            <a
                                href={`/${p.current.league_slug}/${p.current.division_slug}/players/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
                            >
                                {p.name}
                            </a>
                        ) : (
                            <span className="font-medium text-[var(--color-text)]">{p.name}</span>
                        )}
                        {p.main_role && (
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium opacity-60 ${roleColors[p.main_role.toLowerCase()] || roleColors.fill}`}
                                title={`Default: ${p.main_role}${p.secondary_role ? ` / ${p.secondary_role}` : ''}`}
                            >
                                {p.main_role}{p.secondary_role ? `/${p.secondary_role}` : ''}
                            </span>
                        )}
                        {p.isFreeAgent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">FA</span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {p.discord_name || <span className="opacity-30">&mdash;</span>}
                </td>
                <td className="px-3 py-2">
                    {p.currentTeam ? (
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.current?.team_color || '#666' }} />
                            <span className="text-[var(--color-text)]">{p.currentTeam}</span>
                        </span>
                    ) : (
                        <span className="text-[var(--color-text-secondary)] opacity-50">&mdash;</span>
                    )}
                </td>
                <td className="px-3 py-2">
                    {p.currentRole ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleColors[p.currentRole.toLowerCase()] || roleColors.fill}`}>
                            {p.currentRole}
                        </span>
                    ) : <span className="text-[var(--color-text-secondary)] opacity-30">&mdash;</span>}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] tabular-nums">{p.seasonsPlayed}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] tabular-nums">{p.totalGames}</td>
                <td className="px-3 py-2">
                    <button
                        onClick={onOpenAliases}
                        className="flex items-center gap-1.5 text-xs group"
                        title={p.aliases.length > 0 ? p.aliases.map(a => a.alias).join(', ') : 'No aliases — click to add'}
                    >
                        <Tag className="w-3 h-3 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
                        {p.aliases.length > 0 ? (
                            <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors tabular-nums">
                                {p.aliases.length}
                            </span>
                        ) : (
                            <span className="text-[var(--color-text-secondary)] opacity-30 group-hover:opacity-100 group-hover:text-[var(--color-accent)] transition-all">
                                0
                            </span>
                        )}
                    </button>
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        {p.tracker_url && (
                            <a
                                href={p.tracker_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                title="Tracker.gg Profile"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                            title="Edit player info"
                        >
                            Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="text-xs text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
                                title="Delete player (no games, no discord)"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* Expanded detail */}
            {isExpanded && (
                <tr className="border-b border-white/5">
                    <td colSpan={10} className="px-4 py-3 bg-white/[0.01]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Contact info */}
                            <div>
                                <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-2">Contact & Links</h4>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex gap-2">
                                        <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Discord:</span>
                                        <span className="text-[var(--color-text)]">{p.discord_name || <span className="opacity-30">Not set</span>}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Tracker:</span>
                                        {p.tracker_url ? (
                                            <a href={p.tracker_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline truncate">
                                                {p.tracker_url.replace(/^https?:\/\//, '')}
                                            </a>
                                        ) : <span className="text-[var(--color-text)] opacity-30">Not set</span>}
                                    </div>
                                    {p.aliases.length > 0 && (
                                        <div className="flex gap-2">
                                            <span className="text-[var(--color-text-secondary)] w-20 shrink-0">Aliases:</span>
                                            <span className="text-[var(--color-text)] flex flex-wrap gap-1">
                                                {p.aliases.map(a => (
                                                    <span key={a.alias_id} className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                                        {a.alias}
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Season history */}
                            <div>
                                <h4 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-2">Season History</h4>
                                <div className="space-y-1">
                                    {p.rosters.length === 0 ? (
                                        <p className="text-xs text-[var(--color-text-secondary)] opacity-50">No roster history</p>
                                    ) : p.rosters.map(r => (
                                        <div key={r.league_player_id} className="flex items-center gap-2 text-xs">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active && r.season_is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color || '#666' }} />
                                            <span className="text-[var(--color-text)]">{r.team_name}</span>
                                            <span className="text-[var(--color-text-secondary)]">&middot;</span>
                                            <span className="text-[var(--color-text-secondary)]">{r.league_name} {r.division_name} {r.season_name}</span>
                                            {r.role && <span className="text-[var(--color-text-secondary)]">({r.role === 'Sub' ? 'Rule 0-Sub' : r.role})</span>}
                                            <span className="text-[var(--color-text-secondary)] tabular-nums">{p.gameCountMap[r.league_player_id] || 0}g</span>
                                            {!r.is_active && <span className="text-red-400/60 text-[10px]">dropped</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}
