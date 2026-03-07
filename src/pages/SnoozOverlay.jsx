import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Pencil, X, Check, Trash2, Shield, Swords, Target, Heart, Flame, Crown, TrendingUp, Settings, Upload, Save, Trophy, RefreshCw, GripVertical } from 'lucide-react'
import TeamLogo from '../components/TeamLogo'
import { getLeagueLogo } from '../utils/leagueImages'
import { getDivisionImage } from '../utils/divisionImages'
import smiteLogo from '../assets/smite2.png'
import soloIcon from '../assets/roles/solo.webp'
import jungleIcon from '../assets/roles/jungle.webp'
import midIcon from '../assets/roles/mid.webp'
import suppIcon from '../assets/roles/supp.webp'
import adcIcon from '../assets/roles/adc.webp'

const ROLE_IMAGES = { Solo: soloIcon, Jungle: jungleIcon, Mid: midIcon, Support: suppIcon, ADC: adcIcon }

const API_BASE = '/api'
const QR_URL = 'https://smitecomp.com/osl'

/* ─── Ticker ─── */
const StreamTicker = ({ tickerPlayers, leagueColor }) => {
    if (!tickerPlayers || tickerPlayers.length === 0) return null

    const items = tickerPlayers.map(p => {
        const k = Number(p.avg_kills) || 0
        const d = Number(p.avg_deaths) || 0
        const a = Number(p.avg_assists) || 0
        const kda = d > 0 ? ((k + a / 2) / d).toFixed(1) : (k + a / 2).toFixed(1)
        return { name: p.name, team: p.team_name, kda, kills: k.toFixed(1), deaths: d.toFixed(1), assists: a.toFixed(1) }
    })
    const track = [...items, ...items]

    return (
        <div className="relative overflow-hidden py-3 font-mono" style={{ maskImage: 'linear-gradient(90deg, transparent, black 2%, black 98%, transparent)' }}>
            <div className="flex gap-12 animate-[ticker_90s_linear_infinite] w-max">
                {track.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 shrink-0 text-base tracking-wide uppercase">
                        <span className="font-black text-white">{p.name}</span>
                        <span className="text-white/30 text-sm">{p.team}</span>
                        <span className="font-black tabular-nums text-lg" style={{ color: leagueColor }}>{p.kda}</span>
                        <span className="text-white/25 tabular-nums text-sm">{p.kills}/{p.deaths}/{p.assists}</span>
                        <span className="text-white/10 mx-1">|</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ─── Settings Modal ─── */
const SettingsModal = ({ open, onClose, people, onAdd, onRename, onRemove, onReorder, customBg, onSetCustomBg }) => {
    const [editingId, setEditingId] = useState(null)
    const [editName, setEditName] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [dragIdx, setDragIdx] = useState(null)
    const [dragOverIdx, setDragOverIdx] = useState(null)
    const fileInputRef = useRef(null)

    if (!open) return null

    const startEdit = (p) => { setEditingId(p.id); setEditName(p.name) }
    const saveEdit = () => {
        if (editName.trim()) { onRename(editingId, editName.trim()); setEditingId(null) }
    }

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = (e) => onSetCustomBg(e.target.result)
        reader.readAsDataURL(file)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files[0])
    }

    const handlePanelistDragEnd = (e) => {
        e.preventDefault()
        if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
            onReorder(dragIdx, dragOverIdx)
        }
        setDragIdx(null)
        setDragOverIdx(null)
    }

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-[#141e2b] border border-white/10 rounded-2xl shadow-2xl w-[420px] overflow-hidden"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div className="text-base font-black text-white uppercase tracking-wider">Panelists</div>
                    <button onClick={onClose} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-2.5 max-h-[300px] overflow-y-auto">
                    {people.length === 0 && <div className="text-white/20 text-sm text-center py-8">No panelists added yet</div>}
                    {people.map((p, idx) => (
                        <div key={p.id}
                            draggable={editingId !== p.id}
                            onDragStart={() => setDragIdx(idx)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
                            onDragEnd={handlePanelistDragEnd}
                            className={`flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-3 border group/item transition-all ${
                                dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.05]'
                            } ${dragIdx === idx ? 'opacity-40' : ''}`}>
                            <div className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/30 transition-colors shrink-0">
                                <GripVertical size={16} />
                            </div>
                            {editingId === p.id ? (
                                <>
                                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                                        className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-1.5 text-base text-white outline-none focus:border-white/40" />
                                    <button onClick={saveEdit} className="text-green-400 hover:text-green-300 cursor-pointer p-1"><Check size={18} /></button>
                                    <button onClick={() => setEditingId(null)} className="text-white/30 hover:text-white/60 cursor-pointer p-1"><X size={18} /></button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-base font-bold text-white/80">{p.name}</span>
                                    <button onClick={() => startEdit(p)} className="opacity-0 group-hover/item:opacity-100 text-white/30 hover:text-white/60 cursor-pointer p-1 transition-opacity"><Pencil size={16} /></button>
                                    <button onClick={() => onRemove(p.id)} className="opacity-0 group-hover/item:opacity-100 text-red-400/40 hover:text-red-400 cursor-pointer p-1 transition-opacity"><Trash2 size={16} /></button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className="px-5 pb-3">
                    <button onClick={onAdd}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/70 text-sm font-bold transition-all cursor-pointer border border-white/[0.06]">
                        <Plus size={16} /> Add Panelist
                    </button>
                </div>

                {/* Background image drop zone */}
                <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
                    <div className="text-xs font-black text-white/30 uppercase tracking-wider mb-2">Background Image</div>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-2 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-all ${dragOver ? 'border-white/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}`}
                    >
                        <Upload size={20} className="text-white/20" />
                        <div className="text-sm text-white/30">Drop image here or click to upload</div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }} />
                    </div>
                    {customBg && (
                        <button onClick={() => onSetCustomBg(null)}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-xs font-bold transition-all cursor-pointer border border-red-500/10">
                            <X size={14} /> Remove Custom Background
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─── Team Stats Panel ─── */
const TeamStatsPanel = ({ team, standings, players, leagueColor, onSelectPlayer, selectedPlayerId }) => {
    if (!team) return null
    const record = standings.find(s => s.team_id === team.team_id || s.team_id === team.team1_id)
    const teamPlayers = players.filter(p => p.team_id === (team.team_id || team.team1_id))

    const totalGames = record ? (Number(record.game_wins) + Number(record.game_losses)) : 0
    const gameWinRate = totalGames > 0 ? ((Number(record.game_wins) / totalGames) * 100).toFixed(0) : '—'

    return (
        <div className="h-full flex flex-col" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/[0.06]">
                <TeamLogo slug={team.team_slug} name={team.team_name} size={48} color={team.team_color} logoUrl={team.team_logo} />
                <div className="min-w-0 flex-1">
                    <div className="font-black text-xl text-white truncate">{team.team_name}</div>
                    <div className="text-sm text-white/40 font-mono tabular-nums">
                        {record ? <><span className="text-green-400">{record.wins}W</span> – <span className="text-red-400">{record.losses}L</span></> : <><span className="text-green-400">0W</span> – <span className="text-red-400">0L</span></>}
                        {record ? ` · ${record.game_wins}–${record.game_losses} games` : ''}
                        {gameWinRate !== '—' && <span className="ml-1.5" style={{ color: leagueColor }}>({gameWinRate}%)</span>}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {teamPlayers.length === 0 && <div className="text-white/20 text-sm text-center py-4">No stats available</div>}
                {teamPlayers.map(p => {
                    const k = Number(p.avg_kills) || 0
                    const d = Number(p.avg_deaths) || 0
                    const a = Number(p.avg_assists) || 0
                    const kda = d > 0 ? ((k + a / 2) / d).toFixed(2) : '—'
                    const isSelected = selectedPlayerId === p.id
                    const gp = Number(p.games_played) || 0
                    const roleImg = ROLE_IMAGES[p.role]

                    return (
                        <button key={p.id} onClick={() => onSelectPlayer(isSelected ? null : p)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-left ${isSelected ? 'bg-white/[0.08] border border-white/[0.1]' : 'hover:bg-white/[0.04] border border-transparent'}`}>
                            {roleImg ? (
                                <img src={roleImg} alt={p.role} className="w-7 h-7 object-contain shrink-0 opacity-70" />
                            ) : (
                                <div className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-black shrink-0"
                                    style={{ background: `${team.team_color}20`, color: team.team_color }}>
                                    {(p.role || '?')[0]}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>{p.name}</span>
                                    {p.roster_status === 'captain' && <Crown size={11} className="text-yellow-500/60 shrink-0" />}
                                    {p.roster_status === 'co_captain' && <Crown size={11} className="text-yellow-500/40 shrink-0" />}
                                </div>
                                <div className="text-xs text-white/25 font-mono">{p.role || '—'}{gp > 0 ? ` · ${gp}g` : ''}</div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-black tabular-nums" style={{ color: leagueColor }}>{kda}</div>
                                <div className="text-xs text-white/20 font-mono tabular-nums">{k.toFixed(1)}/{d.toFixed(1)}/{a.toFixed(1)}</div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ─── Player Detail Panel ─── */
const PlayerDetailPanel = ({ player, leagueColor }) => {
    if (!player) return null

    const k = Number(player.avg_kills) || 0
    const d = Number(player.avg_deaths) || 0
    const a = Number(player.avg_assists) || 0
    const kda = d > 0 ? ((k + a / 2) / d).toFixed(2) : '—'
    const gp = Number(player.games_played) || 0
    const wins = Number(player.wins) || 0
    const wr = gp > 0 ? ((wins / gp) * 100).toFixed(0) : '—'
    const roleImg = ROLE_IMAGES[player.role]

    const stats = [
        { label: 'KDA', value: kda, icon: Target, color: leagueColor },
        { label: 'Games', value: gp, icon: Swords, color: '#94a3b8' },
        { label: 'Win Rate', value: wr !== '—' ? `${wr}%` : '—', icon: Crown, color: '#facc15' },
        { label: 'Avg Kills', value: k.toFixed(1), icon: Flame, color: '#ef4444' },
        { label: 'Avg Deaths', value: d.toFixed(1), icon: Shield, color: '#6b7280' },
        { label: 'Avg Assists', value: a.toFixed(1), icon: Heart, color: '#22c55e' },
        { label: 'Avg Damage', value: player.avg_damage ? Math.round(Number(player.avg_damage)).toLocaleString() : '—', icon: TrendingUp, color: '#f97316' },
        { label: 'Avg Mitigated', value: player.avg_mitigated ? Math.round(Number(player.avg_mitigated)).toLocaleString() : '—', icon: Shield, color: '#3b82f6' },
    ]

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="flex items-center gap-2.5 mb-3">
                {roleImg ? (
                    <img src={roleImg} alt={player.role} className="w-8 h-8 object-contain opacity-70" />
                ) : (
                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-black"
                        style={{ background: `${player.team_color}30`, color: player.team_color }}>
                        {(player.role || '?')[0]}
                    </div>
                )}
                <div>
                    <div className="text-lg font-black text-white">{player.name}</div>
                    <div className="text-xs text-white/30">{player.role || '—'} · {player.team_name}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {stats.map(s => (
                    <div key={s.label} className="bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/[0.04]">
                        <div className="flex items-center gap-1.5 mb-1">
                            <s.icon size={12} style={{ color: s.color }} className="opacity-60" />
                            <span className="text-[11px] text-white/30 uppercase tracking-wider font-bold">{s.label}</span>
                        </div>
                        <div className="text-base font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   Main Overlay — 1920×1080
   ═══════════════════════════════════════════════════════════════════ */
/* ─── Scores Overlay ─── */
const ScoresOverlay = ({ open, onClose, scores, people, allPanelists, savedWeeks, leagueColor, completeMisses, maxWeek, allDivScores, allDivCompleteMisses, allDivSavedWeeks, activeDivisionName }) => {
    const [showAll, setShowAll] = useState(false)
    if (!open) return null

    const activeScores = showAll ? allDivScores : scores
    const activeMisses = showAll ? allDivCompleteMisses : completeMisses
    const activeWeeks = showAll ? allDivSavedWeeks : savedWeeks

    const weeks = activeWeeks?.length > 0 ? activeWeeks : []
    const totalMisses = activeMisses?.length || 0

    // Sort all panelists (across all weeks) by cumulative score descending
    const scorePeople = allPanelists.length > 0 ? allPanelists : people
    const ranked = scorePeople.map(p => {
        const pid = String(p.serverId || p.id)
        const pScores = activeScores?.[pid] || {}
        const cumCorrect = Object.values(pScores).reduce((s, w) => s + w.correct, 0)
        const cumTotal = Object.values(pScores).reduce((s, w) => s + w.total, 0)
        return { ...p, pid, pScores, cumCorrect, cumTotal }
    }).sort((a, b) => b.cumCorrect - a.cumCorrect || a.cumTotal - b.cumTotal)

    const missCountByWeek = {}
    for (const cm of (activeMisses || [])) {
        missCountByWeek[cm.week] = (missCountByWeek[cm.week] || 0) + 1
    }

    return (
        <div className="absolute inset-0 z-[80] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div className="relative w-[1200px] max-h-[900px] overflow-auto rounded-2xl border border-white/[0.1]"
                onClick={e => e.stopPropagation()}
                style={{ background: 'linear-gradient(135deg, #0e1620 0%, #131d28 50%, #0e1620 100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-10 py-8 border-b border-white/[0.06]">
                    <div>
                        <h2 className="text-3xl font-black tracking-[0.15em] uppercase"
                            style={{ background: `linear-gradient(135deg, ${leagueColor}, #fff, ${leagueColor})`, backgroundSize: '200% 200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Season Scoreboard
                        </h2>
                        <div className="text-white/30 text-sm font-mono mt-1 tracking-wider uppercase">
                            {weeks.length} week{weeks.length !== 1 ? 's' : ''} scored
                            {totalMisses > 0 && <span className="text-red-400/50 ml-3">{totalMisses} complete miss{totalMisses !== 1 ? 'es' : ''}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex rounded-lg overflow-hidden border border-white/[0.1]">
                            <button onClick={() => setShowAll(false)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${!showAll ? 'bg-white/[0.1] text-white' : 'text-white/30 hover:text-white/50'}`}>
                                {activeDivisionName || 'Division'}
                            </button>
                            <button onClick={() => setShowAll(true)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${showAll ? 'bg-white/[0.1] text-white' : 'text-white/30 hover:text-white/50'}`}>
                                All Divisions
                            </button>
                        </div>
                        <button onClick={onClose} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors p-2"><X size={24} /></button>
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="px-10 py-6">
                    {ranked.length === 0 || !activeScores || Object.keys(activeScores).length === 0 ? (
                        <div className="text-center text-white/20 py-16 text-lg">No scores yet. Save predictions and play some matches!</div>
                    ) : (
                        <div className="space-y-1">
                            {/* Column headers */}
                            <div className="flex items-center gap-3 px-4 py-2 text-xs font-black tracking-[0.15em] uppercase text-white/20">
                                <div className="w-8 text-center">#</div>
                                <div className="flex-1">Panelist</div>
                                {weeks.map(w => (
                                    <div key={w} className="w-16 text-center">W{w}</div>
                                ))}
                                <div className="w-20 text-center">Total</div>
                                <div className="w-16 text-center">%</div>
                            </div>

                            {ranked.map((p, i) => {
                                const pct = p.cumTotal > 0 ? Math.round((p.cumCorrect / p.cumTotal) * 100) : 0
                                const isFirst = i === 0 && p.cumCorrect > 0
                                return (
                                    <div key={p.id}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                                            isFirst ? 'bg-white/[0.06] border-white/[0.1]' : 'bg-white/[0.02] border-transparent'
                                        }`}
                                        style={{ animation: `fadeIn 0.3s ease-out ${i * 0.05}s both` }}>
                                        <div className="w-8 text-center text-lg font-black" style={{ color: isFirst ? leagueColor : 'rgba(255,255,255,0.2)' }}>
                                            {isFirst ? '\u2B50' : i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-lg font-black truncate ${isFirst ? 'text-white' : 'text-white/60'}`}>{p.name}</div>
                                        </div>
                                        {weeks.map(w => {
                                            const ws = p.pScores[w]
                                            return (
                                                <div key={w} className="w-16 text-center text-sm font-mono tabular-nums">
                                                    {ws ? (
                                                        <span style={{ color: ws.correct === ws.total ? '#22c55e' : ws.correct === 0 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.5)' }}>
                                                            {ws.correct}/{ws.total}
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/10">-</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        <div className="w-20 text-center text-xl font-black tabular-nums" style={{ color: leagueColor }}>
                                            {p.cumCorrect}/{p.cumTotal}
                                        </div>
                                        <div className="w-16 text-center text-sm font-bold tabular-nums text-white/30">{pct}%</div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Complete Misses by week */}
                    {totalMisses > 0 && (
                        <div className="mt-8 pt-6 border-t border-white/[0.06]">
                            <div className="text-xs font-black tracking-[0.2em] uppercase text-red-400/40 mb-3">Complete Misses</div>
                            <div className="flex gap-3 flex-wrap">
                                {weeks.map(w => {
                                    const count = missCountByWeek[w] || 0
                                    if (count === 0) return null
                                    return (
                                        <div key={w} className="bg-red-500/[0.08] border border-red-500/15 rounded-lg px-4 py-2">
                                            <div className="text-xs text-white/30 font-bold uppercase">Week {w}</div>
                                            <div className="text-lg font-black text-red-400/60">{count} miss{count !== 1 ? 'es' : ''}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const SnoozOverlay = () => {
    const { week } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedDivision, setSelectedDivision] = useState(null)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState(null)
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [scores, setScores] = useState(null)
    const [completeMisses, setCompleteMisses] = useState([])
    const [savedWeeks, setSavedWeeks] = useState([])
    const [allDivScores, setAllDivScores] = useState(null)
    const [allDivCompleteMisses, setAllDivCompleteMisses] = useState([])
    const [allDivSavedWeeks, setAllDivSavedWeeks] = useState([])
    const [maxWeek, setMaxWeek] = useState(null)
    const [saving, setSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState(null)
    const [scoresOpen, setScoresOpen] = useState(false)
    const [allSnoozPanelists, setAllSnoozPanelists] = useState([])
    const hasAuth = !!localStorage.getItem('auth_token')
    const [customBg, setCustomBg] = useState(() => {
        try { return localStorage.getItem('snooz_custom_bg') || null } catch { return null }
    })

    const handleSetCustomBg = useCallback((bg) => {
        setCustomBg(bg)
        if (bg) localStorage.setItem('snooz_custom_bg', bg)
        else localStorage.removeItem('snooz_custom_bg')
    }, [])

    const [people, setPeople] = useState([])
    const [picks, setPicks] = useState({})

    const draftKey = `snooz_draft_${week}_${selectedDivision || 'default'}`
    const saveDraft = useCallback((p, pk) => {
        localStorage.setItem(draftKey, JSON.stringify({ people: p, picks: pk }))
    }, [draftKey])
    const clearDraft = useCallback(() => {
        localStorage.removeItem(draftKey)
    }, [draftKey])

    const savePeople = useCallback((p) => {
        setPeople(p)
        setPicks(prev => { saveDraft(p, prev); return prev })
    }, [saveDraft])
    const savePicks = useCallback((pk) => {
        setPicks(pk)
        setPeople(prev => { saveDraft(prev, pk); return prev })
    }, [saveDraft])

    const [syncing, setSyncing] = useState(false)
    const handleSync = useCallback(() => {
        clearDraft()
        setSyncing(true)
    }, [clearDraft])

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            setPeople([])
            setPicks({})
            try {
                const params = new URLSearchParams({ week })
                if (selectedDivision) params.append('divisionSlug', selectedDivision)
                const res = await fetch(`${API_BASE}/snooz-data?${params}`)
                const json = await res.json()
                setData(json)
                if (!selectedDivision && json.activeDivision) setSelectedDivision(json.activeDivision.slug)

                // Check for a local draft first (unsaved edits survive refresh)
                const divSlug = selectedDivision || json.activeDivision?.slug || 'default'
                const draft = JSON.parse(localStorage.getItem(`snooz_draft_${week}_${divSlug}`) || 'null')
                if (draft && draft.people?.length > 0) {
                    setPeople(draft.people)
                    setPicks(draft.picks || {})
                } else if (json.savedPanelists?.length > 0) {
                    // No draft — load from server
                    const serverPeople = json.savedPanelists.map(p => ({ id: String(p.id), name: p.name, serverId: p.id }))
                    setPeople(serverPeople)

                    if (json.savedPicks?.length > 0) {
                        const allMatches = json.matches || []
                        const serverPicks = {}
                        for (const sp of json.savedPicks) {
                            const match = allMatches.find(m =>
                                Math.min(m.team1_id, m.team2_id) === sp.team_a_id &&
                                Math.max(m.team1_id, m.team2_id) === sp.team_b_id
                            )
                            if (match) {
                                serverPicks[`${match.id}_${String(sp.panelist_id)}`] = sp.picked_team_id
                            }
                        }
                        setPicks(serverPicks)
                    } else {
                        setPicks({})
                    }
                }

                setScores(json.scores || null)
                setCompleteMisses(json.completeMisses || [])
                setSavedWeeks(json.savedWeeks || [])
                setAllDivScores(json.allDivScores || null)
                setAllDivCompleteMisses(json.allDivCompleteMisses || [])
                setAllDivSavedWeeks(json.allDivSavedWeeks || [])
                setMaxWeek(json.maxWeek || null)
                setAllSnoozPanelists((json.allSnoozPanelists || []).map(p => ({ id: String(p.id), name: p.name, serverId: p.id })))
                setSaveStatus(null)
            } catch (err) {
                console.error('Failed to load snooz data:', err)
            } finally {
                setLoading(false)
                setSyncing(false)
            }
        }
        fetchData()
    }, [week, selectedDivision, syncing])

    const leagueColor = data?.league?.color || '#f59e0b'
    const leagueLogo = getLeagueLogo('osl')
    const divisionImage = data?.activeDivision ? getDivisionImage('osl', data.activeDivision.slug, data.activeDivision.tier) : null

    const divTier = data?.activeDivision?.tier || 1
    const divAccent = { 1: '#c9a44a', 2: '#b93b3b', 4: '#6b5ce7', 5: '#3b9fbf' }[divTier] || '#888'

    const addPerson = () => {
        const id = Date.now().toString(36)
        savePeople([...people, { id, name: `Person ${people.length + 1}` }])
    }
    const renamePerson = (id, newName) => {
        const allMatches = data?.matches || []
        const newPicks = { ...picks }

        // Clear old person's picks for current week
        for (const m of allMatches) {
            delete newPicks[`${m.id}_${id}`]
        }

        // Check if new name has existing server picks for this week
        const serverPanelist = (data?.allSnoozPanelists || []).find(p => p.name.toLowerCase() === newName.toLowerCase())
        if (serverPanelist) {
            for (const sp of (data?.savedPicks || [])) {
                if (sp.panelist_id !== serverPanelist.id) continue
                const match = allMatches.find(m =>
                    Math.min(m.team1_id, m.team2_id) === sp.team_a_id &&
                    Math.max(m.team1_id, m.team2_id) === sp.team_b_id
                )
                if (match) newPicks[`${match.id}_${id}`] = sp.picked_team_id
            }
        }

        savePicks(newPicks)
        savePeople(people.map(p => p.id === id ? { ...p, name: newName, serverId: serverPanelist?.id || null } : p))
    }
    const reorderPerson = (fromIdx, toIdx) => {
        const updated = [...people]
        const [moved] = updated.splice(fromIdx, 1)
        updated.splice(toIdx, 0, moved)
        savePeople(updated)
    }
    const removePerson = (id) => {
        savePeople(people.filter(p => p.id !== id))
        const newPicks = { ...picks }
        Object.keys(newPicks).forEach(k => { if (k.endsWith(`_${id}`)) delete newPicks[k] })
        savePicks(newPicks)
    }

    const handlePick = (matchId, personId, teamId) => {
        const key = `${matchId}_${personId}`
        const newPicks = { ...picks }
        if (newPicks[key] === teamId) delete newPicks[key]
        else newPicks[key] = teamId
        savePicks(newPicks)
    }

    const handleSave = async () => {
        const token = localStorage.getItem('auth_token')
        if (!token || saving) return
        setSaving(true)
        setSaveStatus(null)
        try {
            const seasonId = data?.activeDivision?.season_id
            if (!seasonId) throw new Error('No season')

            const panelists = people.map(p => ({ id: p.serverId || null, name: p.name }))

            const serverPicks = []
            for (const [key, teamId] of Object.entries(picks)) {
                const [matchId, panelistId] = key.split('_')
                const match = matches.find(m => String(m.id) === matchId)
                if (!match) continue
                const panelistIndex = people.findIndex(p => p.id === panelistId)
                if (panelistIndex === -1) continue
                serverPicks.push({ panelistIndex, team1Id: match.team1_id, team2Id: match.team2_id, pickedTeamId: teamId })
            }

            const res = await fetch(`${API_BASE}/snooz-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ seasonId, week: parseInt(week), panelists, picks: serverPicks })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || `Save failed (${res.status})`)
            }

            const result = await res.json()
            const oldToNew = {}
            people.forEach((p, i) => {
                if (result.panelists[i]) oldToNew[p.id] = String(result.panelists[i].id)
            })

            const newPeople = result.panelists.map(p => ({ id: String(p.id), name: p.name, serverId: p.id }))
            const newPicks = {}
            for (const [key, value] of Object.entries(picks)) {
                const [matchId, oldPanelistId] = key.split('_')
                newPicks[`${matchId}_${oldToNew[oldPanelistId] || oldPanelistId}`] = value
            }

            setPeople(newPeople)
            setPicks(newPicks)
            clearDraft()
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus(null), 3000)
        } catch (err) {
            console.error('Save failed:', err)
            setSaveStatus('error')
            setTimeout(() => setSaveStatus(null), 3000)
        } finally {
            setSaving(false)
        }
    }

    const handleTeamClick = (teamData) => {
        const standing = data?.standings?.find(s => s.team_id === teamData.id)
        if (selectedTeam?.team_id === teamData.id) {
            setSelectedTeam(null)
            setSelectedPlayer(null)
        } else {
            setSelectedTeam(standing || { team_id: teamData.id, team_name: teamData.name, team_color: teamData.color, team_slug: teamData.slug, team_logo: teamData.logo })
            setSelectedPlayer(null)
        }
    }

    const matches = data?.matches || []
    const standings = data?.standings || []
    const allPlayers = data?.allPlayers || []

    if (loading && !data) {
        return (
            <div className="w-[1920px] h-[1080px] bg-black flex items-center justify-center">
                <div className="text-white/30 text-3xl font-mono animate-pulse">Loading...</div>
            </div>
        )
    }

    return (
        <div className="w-[1920px] h-[1080px] bg-black relative overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`
                @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
                @keyframes bgDrift {
                    0%   { background-position: 0% 0%; }
                    20%  { background-position: 60% 30%; }
                    40%  { background-position: 100% 60%; }
                    60%  { background-position: 40% 100%; }
                    80%  { background-position: 0% 60%; }
                    100% { background-position: 0% 0%; }
                }
            `}</style>

            {/* Full background — custom image or gradient */}
            {customBg ? (
                <div className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
            ) : (
                <div className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `
                            radial-gradient(ellipse 90% 70% at 15% 20%, ${leagueColor}, transparent 65%),
                            radial-gradient(ellipse 80% 60% at 85% 75%, ${divAccent}, transparent 55%),
                            radial-gradient(ellipse 120% 90% at 50% 50%, ${leagueColor}bb, transparent 50%),
                            radial-gradient(ellipse 60% 50% at 70% 15%, ${divAccent}aa, transparent 50%),
                            linear-gradient(135deg, ${leagueColor}40 0%, ${divAccent}30 50%, ${leagueColor}50 100%)
                        `,
                        backgroundSize: '300% 300%',
                        animation: 'bgDrift 35s ease infinite',
                    }}
                />
            )}

            {/* ═══ Header ═══ */}
            <div className="relative z-30 flex items-center justify-between px-8 pt-4 pb-2">
                <div className="flex items-center gap-4">
                    {leagueLogo && <img src={leagueLogo} alt="OSL" className="w-16 h-16 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]" />}
                    <div>
                        <h1 className="text-3xl font-black tracking-[0.15em] uppercase"
                            style={{ background: `linear-gradient(135deg, ${leagueColor}, #fff, ${leagueColor})`, backgroundSize: '200% 200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'gradientShift 4s ease infinite' }}>
                            ASSOCIATED PRESS
                        </h1>
                        <div className="flex items-center gap-2 text-white/40 text-sm font-mono tracking-[0.25em] uppercase">
                            <button onClick={() => navigate(`/snooz/${Math.max(1, parseInt(week) - 1)}`)}
                                disabled={parseInt(week) <= 1}
                                className="text-white/25 hover:text-white/60 disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors p-0.5">
                                <ChevronLeft size={16} />
                            </button>
                            <span>Week {week} Predictions</span>
                            <button onClick={() => navigate(`/snooz/${parseInt(week) + 1}`)}
                                disabled={maxWeek && parseInt(week) >= maxWeek}
                                className="text-white/25 hover:text-white/60 disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors p-0.5">
                                <ChevronRight size={16} />
                            </button>
                            {savedWeeks.length > 0 && (
                                <div className="flex items-center gap-1 ml-2">
                                    {Array.from({ length: maxWeek || parseInt(week) }, (_, i) => i + 1).map(w => (
                                        <button key={w} onClick={() => navigate(`/snooz/${w}`)}
                                            className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                                w === parseInt(week) ? 'bg-white/20 text-white' :
                                                savedWeeks.includes(w) ? 'bg-white/[0.06] text-white/40 hover:bg-white/10' :
                                                'bg-white/[0.02] text-white/15'
                                            }`}>
                                            {w}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {data?.activeDivision && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                        {divisionImage && <img src={divisionImage} alt="" className="w-12 h-12 object-contain opacity-80" />}
                        <div className="text-xl font-black uppercase tracking-wider text-white/60">{data.activeDivision.name}</div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {data?.divisions?.length > 1 && (
                        <div className="relative">
                            <button onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-black/30 hover:bg-black/50 border border-white/[0.1] text-sm font-bold text-white/70 transition-all cursor-pointer backdrop-blur-sm">
                                {divisionImage && <img src={divisionImage} className="w-5 h-5 object-contain opacity-80" />}
                                {data.activeDivision?.name || 'Division'}
                                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-[#141e2b]/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden shadow-2xl z-[60] min-w-[220px]">
                                    {data.divisions.map(div => {
                                        const divImg = getDivisionImage('osl', div.slug, div.tier)
                                        return (
                                            <button key={div.slug}
                                                onClick={() => { setSelectedDivision(div.slug); setDropdownOpen(false); setSelectedTeam(null); setSelectedPlayer(null) }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold transition-all cursor-pointer ${div.slug === data.activeDivision?.slug ? 'text-white bg-white/[0.08]' : 'text-white/50 hover:text-white hover:bg-white/[0.04]'}`}>
                                                {divImg && <img src={divImg} className="w-6 h-6 object-contain opacity-80" />}
                                                {div.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={() => setScoresOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border backdrop-blur-sm bg-black/30 hover:bg-black/50 border-white/[0.08] text-white/50 hover:text-white/70">
                        <Trophy size={14} />
                        Scores
                    </button>

                    {hasAuth && (
                        <>
                            <button onClick={handleSync} disabled={syncing}
                                className="p-2.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/30 hover:text-white/60 transition-all cursor-pointer border border-white/[0.08] backdrop-blur-sm"
                                title="Sync from server (discard local changes)">
                                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border backdrop-blur-sm ${
                                    saveStatus === 'saved' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                    saveStatus === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                    'bg-black/30 hover:bg-black/50 border-white/[0.08] text-white/50 hover:text-white/70'
                                }`}>
                                <Save size={14} />
                                {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save'}
                            </button>
                        </>
                    )}

                    <button onClick={() => setSettingsOpen(true)}
                        className="p-2.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/30 hover:text-white/60 transition-all cursor-pointer border border-white/[0.08] backdrop-blur-sm">
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 flex gap-5 px-8 py-2 min-h-0 relative z-10">

                {/* ── Left: Match Pick Table ── */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {matches.length === 0 ? (
                        <div className="flex items-center justify-center h-full"><div className="text-white/20 text-xl font-mono">No matches for Week {week}</div></div>
                    ) : (
                        <div className="bg-[#131d28] rounded-xl border border-white/[0.1] overflow-hidden flex flex-col h-full">
                            {/* Table header */}
                            <div className="flex items-center border-b border-white/[0.1] bg-[#0e1620]">
                                <div className="w-[280px] shrink-0 px-4 py-3 text-sm font-black tracking-[0.2em] uppercase text-white/30 text-center">Order</div>
                                <div className="w-[280px] shrink-0 px-4 py-3 text-sm font-black tracking-[0.2em] uppercase text-white/30 text-center">Chaos</div>
                                {people.map(p => {
                                    const pid = String(p.serverId || p.id)
                                    const weekScore = scores?.[pid]?.[parseInt(week)]
                                    return (
                                        <div key={p.id} className="flex-1 px-2 py-3 text-center truncate">
                                            <div className="text-sm font-black tracking-[0.1em] uppercase text-white/35">{p.name}</div>
                                            {weekScore && (
                                                <div className="text-xs font-mono tabular-nums" style={{ color: leagueColor }}>
                                                    {weekScore.correct}/{weekScore.total}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Match rows */}
                            <div className="flex-1 flex flex-col">
                                {matches.map((match, idx) => {
                                    const isCompleteMiss = match.is_completed && match.winner_team_id && completeMisses.some(cm =>
                                        cm.week === parseInt(week) &&
                                        cm.teamAId === Math.min(match.team1_id, match.team2_id) &&
                                        cm.teamBId === Math.max(match.team1_id, match.team2_id)
                                    )
                                    return (
                                    <div key={match.id}
                                        className={`relative flex items-center border-b border-white/[0.06] last:border-b-0 transition-colors ${isCompleteMiss ? 'bg-red-500/[0.06]' : 'hover:bg-white/[0.03]'}`}
                                        style={{ flex: '1 1 0', animation: `fadeIn 0.3s ease-out ${idx * 0.04}s both` }}>

                                        {isCompleteMiss && (
                                            <div className="absolute left-1 top-1 z-10 bg-red-500/20 border border-red-500/25 rounded px-2 py-0.5 text-[10px] font-black text-red-400/80 tracking-[0.15em] uppercase pointer-events-none">
                                                Complete Miss!
                                            </div>
                                        )}

                                        <button
                                            onClick={() => handleTeamClick({ id: match.team1_id, name: match.team1_name, color: match.team1_color, slug: match.team1_slug, logo: match.team1_logo })}
                                            className={`w-[280px] shrink-0 grid grid-cols-[56px_1fr] items-center gap-3 px-4 py-1 cursor-pointer transition-colors rounded-l ${selectedTeam?.team_id === match.team1_id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                                            style={{ opacity: match.is_completed && match.winner_team_id && match.winner_team_id !== match.team1_id ? 0.35 : undefined }}
                                        >
                                            <TeamLogo slug={match.team1_slug} name={match.team1_name} size={56} color={match.team1_color} logoUrl={match.team1_logo} />
                                            <div className="min-w-0">
                                                <div className="text-base font-black text-white truncate flex items-center gap-1.5">
                                                    {match.team1_name}
                                                    {match.is_completed && match.winner_team_id === match.team1_id && <Crown size={14} className="text-yellow-500 shrink-0" />}
                                                </div>
                                                <div className="text-xs font-mono tabular-nums">
                                                    {(() => { const r = standings.find(s => s.team_id === match.team1_id); return r ? <><span className="text-green-400">{r.wins}W</span><span className="text-white/25"> – </span><span className="text-red-400">{r.losses}L</span></> : '' })()}
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleTeamClick({ id: match.team2_id, name: match.team2_name, color: match.team2_color, slug: match.team2_slug, logo: match.team2_logo })}
                                            className={`w-[280px] shrink-0 grid grid-cols-[56px_1fr] items-center gap-3 px-4 py-1 cursor-pointer transition-colors ${selectedTeam?.team_id === match.team2_id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                                            style={{ opacity: match.is_completed && match.winner_team_id && match.winner_team_id !== match.team2_id ? 0.35 : undefined }}
                                        >
                                            <TeamLogo slug={match.team2_slug} name={match.team2_name} size={56} color={match.team2_color} logoUrl={match.team2_logo} />
                                            <div className="min-w-0">
                                                <div className="text-base font-black text-white truncate flex items-center gap-1.5">
                                                    {match.team2_name}
                                                    {match.is_completed && match.winner_team_id === match.team2_id && <Crown size={14} className="text-yellow-500 shrink-0" />}
                                                </div>
                                                <div className="text-xs font-mono tabular-nums">
                                                    {(() => { const r = standings.find(s => s.team_id === match.team2_id); return r ? <><span className="text-green-400">{r.wins}W</span><span className="text-white/25"> – </span><span className="text-red-400">{r.losses}L</span></> : '' })()}
                                                </div>
                                            </div>
                                        </button>

                                        {people.map(person => {
                                            const pick = picks[`${match.id}_${person.id}`]
                                            const picked1 = pick === match.team1_id
                                            const picked2 = pick === match.team2_id
                                            const hasPick = picked1 || picked2

                                            if (match.is_completed && match.winner_team_id && hasPick) {
                                                const isWinner1 = match.winner_team_id === match.team1_id
                                                const winnerName = isWinner1 ? match.team1_name : match.team2_name
                                                const winnerColor = isWinner1 ? match.team1_color : match.team2_color
                                                const wasCorrect = pick === match.winner_team_id
                                                const wasWrong = pick !== match.winner_team_id
                                                const displayName = wasWrong ? (picked1 ? match.team1_name : match.team2_name) : winnerName
                                                const displayColor = wasWrong ? (picked1 ? match.team1_color : match.team2_color) : winnerColor
                                                const otherTeamId = picked1 ? match.team2_id : match.team1_id

                                                const Tag = hasAuth ? 'button' : 'div'
                                                return (
                                                    <div key={person.id} className="flex-1 px-1.5 flex items-center justify-center">
                                                        <Tag
                                                            {...(hasAuth ? { onClick: () => handlePick(match.id, person.id, otherTeamId) } : {})}
                                                            className={`w-full py-2 rounded text-sm font-bold text-center truncate px-1.5 ${hasAuth ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                                            style={{
                                                                background: wasCorrect ? displayColor : wasWrong ? 'rgba(239,68,68,0.15)' : `${displayColor}30`,
                                                                color: wasCorrect ? '#fff' : wasWrong ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.25)',
                                                                boxShadow: wasCorrect ? `0 0 12px ${displayColor}40` : 'none',
                                                                textShadow: wasCorrect ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                                                            }}>
                                                            {wasCorrect && '\u2713 '}{wasWrong && '\u2717 '}{displayName}
                                                        </Tag>
                                                    </div>
                                                )
                                            }

                                            if (hasPick) {
                                                const pickedColor = picked1 ? match.team1_color : match.team2_color
                                                const pickedName = picked1 ? match.team1_name : match.team2_name
                                                const otherTeamId = picked1 ? match.team2_id : match.team1_id
                                                return (
                                                    <div key={person.id} className="flex-1 px-1.5 flex items-center justify-center">
                                                        <button
                                                            onClick={() => handlePick(match.id, person.id, otherTeamId)}
                                                            className="w-full py-2 rounded text-sm font-bold transition-all cursor-pointer truncate px-1.5"
                                                            style={{
                                                                background: pickedColor,
                                                                color: '#fff',
                                                                boxShadow: `0 0 12px ${pickedColor}40`,
                                                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                                            }}
                                                            title={`Switch to ${picked1 ? match.team2_name : match.team1_name}`}
                                                        >
                                                            {pickedName}
                                                        </button>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div key={person.id} className="flex-1 px-1.5 flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handlePick(match.id, person.id, match.team1_id)}
                                                        className="flex-1 py-2 rounded text-sm font-bold transition-all cursor-pointer truncate px-1.5"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            color: 'rgba(255,255,255,0.15)',
                                                        }}
                                                        title={match.team1_name}
                                                    >
                                                        {'\u2014'}
                                                    </button>
                                                    <button
                                                        onClick={() => handlePick(match.id, person.id, match.team2_id)}
                                                        className="flex-1 py-2 rounded text-sm font-bold transition-all cursor-pointer truncate px-1.5"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            color: 'rgba(255,255,255,0.15)',
                                                        }}
                                                        title={match.team2_name}
                                                    >
                                                        {'\u2014'}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: Stats Panel ── */}
                <div className="w-[380px] shrink-0 flex flex-col gap-3">
                    <div className="flex-1 bg-[#131d28] rounded-xl border border-white/[0.1] p-5 overflow-hidden min-h-0 flex flex-col">
                        {selectedTeam ? (
                            <TeamStatsPanel
                                team={selectedTeam}
                                standings={standings}
                                players={allPlayers}
                                leagueColor={leagueColor}
                                onSelectPlayer={setSelectedPlayer}
                                selectedPlayerId={selectedPlayer?.id}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                                <Swords size={40} className="text-white/[0.08] mb-3" />
                                <div className="text-white/20 text-base font-bold">Click a team to view stats</div>
                                <div className="text-white/10 text-sm mt-1">Select any team from the matchup table</div>
                            </div>
                        )}
                    </div>

                    {selectedPlayer && (
                        <div className="bg-[#131d28] rounded-xl border border-white/[0.1] p-5 shrink-0">
                            <PlayerDetailPanel player={selectedPlayer} leagueColor={leagueColor} />
                        </div>
                    )}

                    {/* QR Code + Branding */}
                    <div className="flex items-center gap-4 bg-[#131d28] rounded-xl border border-white/[0.1] px-5 py-4 shrink-0">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(QR_URL)}&size=160x160&bgcolor=000000&color=ffffff&format=svg`}
                            alt="QR" className="w-[112px] h-[112px] rounded"
                        />
                        <div className="flex flex-col items-start gap-2">
                            <img src={smiteLogo} alt="SmiteComp" className="h-10 object-contain" />
                            <div>
                                <div className="text-xs text-white/30 uppercase tracking-[0.15em] font-bold">Stats provided by</div>
                                <div className="text-lg font-black text-white/70 mt-0.5">smitecomp.com/osl</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Ticker ═══ */}
            <div className="relative z-10 border-t border-white/[0.1] shrink-0 bg-[#0e1620]">
                <div className="px-4">
                    <StreamTicker tickerPlayers={data?.tickerPlayers} leagueColor={leagueColor} />
                </div>
            </div>

            {/* ═══ Loading Overlay ═══ */}
            {loading && data && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="text-white/50 text-2xl font-mono animate-pulse">Loading...</div>
                </div>
            )}

            {/* ═══ Settings Modal ═══ */}
            <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                people={people}
                onAdd={addPerson}
                onRename={renamePerson}
                onReorder={reorderPerson}
                onRemove={removePerson}
                customBg={customBg}
                onSetCustomBg={handleSetCustomBg}
            />

            {/* ═══ Scores Overlay ═══ */}
            <ScoresOverlay
                open={scoresOpen}
                onClose={() => setScoresOpen(false)}
                scores={scores}
                people={people}
                allPanelists={allSnoozPanelists}
                savedWeeks={savedWeeks}
                leagueColor={leagueColor}
                completeMisses={completeMisses}
                maxWeek={maxWeek}
                allDivScores={allDivScores}
                allDivCompleteMisses={allDivCompleteMisses}
                allDivSavedWeeks={allDivSavedWeeks}
                activeDivisionName={data?.activeDivision?.name}
            />
        </div>
    )
}

export default SnoozOverlay
