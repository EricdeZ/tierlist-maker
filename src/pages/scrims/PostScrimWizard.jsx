import { useState, useEffect, useMemo } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import { scrimService, leagueService } from '../../services/database'
import XpCalendar from '../../components/xp/XpCalendar'
import XpDialog from '../../components/xp/XpDialog'
import { PICK_MODES, XP_PICK_BADGE, formatPickMode } from './scrimUtils'

export default function PostScrimWizard({ captainTeams, allTeams, myScrims, onSuccess, onCancel, editScrim }) {
    const isEdit = !!editScrim

    // Parse edit scrim date/time into components
    const parseEditDateTime = () => {
        if (!editScrim) return {}
        const d = new Date(editScrim.scheduledDate)
        const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        const h = est.getHours()
        return {
            date: `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, '0')}-${String(est.getDate()).padStart(2, '0')}`,
            hour: String(h === 0 ? 12 : h > 12 ? h - 12 : h),
            minute: String(est.getMinutes()).padStart(2, '0'),
            amPm: h >= 12 ? 'PM' : 'AM',
        }
    }
    const editDT = parseEditDateTime()

    const [step, setStep] = useState(isEdit ? 1 : 0)

    // Form state
    const [teamId, setTeamId] = useState(() => isEdit ? editScrim.teamId : (captainTeams[0]?.teamId || ''))
    const [selectedDate, setSelectedDate] = useState(() => isEdit ? editDT.date : null)
    const [timeHour, setTimeHour] = useState(() => isEdit ? editDT.hour : '7')
    const [timeMinute, setTimeMinute] = useState(() => isEdit ? editDT.minute : '00')
    const [timeAmPm, setTimeAmPm] = useState(() => isEdit ? editDT.amPm : 'PM')
    const [pickMode, setPickMode] = useState(() => isEdit ? (editScrim.pickMode || 'regular') : 'regular')
    const [bannedContentLeague, setBannedContentLeague] = useState(() => isEdit ? (editScrim.bannedContentLeague || '') : '')
    const [challengedTeamId, setChallengedTeamId] = useState(() => isEdit ? (editScrim.challengedTeamId || '') : '')
    const [notes, setNotes] = useState(() => isEdit ? (editScrim.notes || '') : '')
    const [acceptableTiers, setAcceptableTiers] = useState(() => {
        if (isEdit) return editScrim.acceptableTiers || [1, 2, 3, 4, 5]
        const tier = captainTeams[0]?.divisionTier
        if (!tier) return [1, 2, 3, 4, 5]
        const tiers = [tier]
        if (tier > 1) tiers.push(tier - 1)
        return tiers.sort((a, b) => a - b)
    })

    // New: Division/Region/Confirmation state
    const [filterMode, setFilterMode] = useState(() => isEdit && editScrim.acceptableDivisions?.length ? 'division' : 'tier')
    const [acceptableDivisions, setAcceptableDivisions] = useState(() => isEdit ? (editScrim.acceptableDivisions || []) : [])
    const [activeDivisions, setActiveDivisions] = useState([])
    const [region, setRegion] = useState(() => {
        if (isEdit) return editScrim.region || 'NA'
        return captainTeams[0]?.leagueSlug === 'tanuki-smite-league' ? 'EU' : 'NA'
    })
    const [requiresConfirmation, setRequiresConfirmation] = useState(() => isEdit ? !!editScrim.requiresConfirmation : false)
    const [allowCommunityTeams, setAllowCommunityTeams] = useState(() => isEdit ? !!editScrim.allowCommunityTeams : false)

    // UI state
    const [teamSearch, setTeamSearch] = useState('')
    const [showTeamPicker, setShowTeamPicker] = useState(false)
    const [showConflictDialog, setShowConflictDialog] = useState(null)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [posting, setPosting] = useState(false)
    const [postError, setPostError] = useState(null)
    const [postSuccess, setPostSuccess] = useState(false)
    const [leagues, setLeagues] = useState([])

    // Update acceptable tiers + region when team changes (skip for edit mode — values pre-filled)
    useEffect(() => {
        if (isEdit) return
        const team = captainTeams.find(t => t.teamId === Number(teamId))
        const tier = team?.divisionTier
        if (!tier) { setAcceptableTiers([1, 2, 3, 4, 5]); return }
        const tiers = [tier]
        if (tier > 1) tiers.push(tier - 1)
        setAcceptableTiers(tiers.sort((a, b) => a - b))
        setRegion(team?.leagueSlug === 'tanuki-smite-league' ? 'EU' : 'NA')
    }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch leagues for banned content dropdown + active divisions for filter
    useEffect(() => {
        leagueService.getAll().then(data => setLeagues(data || [])).catch(() => {})
        scrimService.getActiveDivisions().then(data => setActiveDivisions(data.divisions || [])).catch(() => {})
    }, [])

    const selectedTeam = captainTeams.find(t => t.teamId === Number(teamId))
    const tierImg = selectedTeam ? getDivisionImage(selectedTeam.leagueSlug, selectedTeam.divisionSlug, selectedTeam.divisionTier) : null

    // Get scrim dates for the selected team (for calendar)
    const scrimDates = useMemo(() => {
        const dates = new Set()
        if (!selectedTeam) return dates
        const tid = selectedTeam.teamId
        for (const s of (myScrims || [])) {
            if ((s.teamId === tid || s.acceptedTeamId === tid) && (s.status === 'open' || s.status === 'accepted')) {
                // Convert to EST date string
                const d = new Date(s.scheduledDate)
                const est = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
                const dateStr = `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, '0')}-${String(est.getDate()).padStart(2, '0')}`
                dates.add(dateStr)
            }
        }
        return dates
    }, [myScrims, selectedTeam])

    // Filter challenge teams — only exclude the selected posting team
    const filteredChallengeTeams = useMemo(() => {
        const selectedId = Number(teamId)
        return allTeams.filter(t =>
            t.id !== selectedId && (teamSearch === '' ||
                t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                t.leagueName.toLowerCase().includes(teamSearch.toLowerCase()) ||
                t.divisionName.toLowerCase().includes(teamSearch.toLowerCase()))
        )
    }, [allTeams, teamId, teamSearch])

    const challengedTeam = allTeams.find(t => t.id === Number(challengedTeamId))

    // Map tier → unique division names for display
    const tierDivisions = useMemo(() => {
        const map = {}
        for (const t of allTeams) {
            if (t.divisionTier) {
                if (!map[t.divisionTier]) map[t.divisionTier] = new Set()
                map[t.divisionTier].add(t.divisionName)
            }
        }
        const result = {}
        for (const [tier, names] of Object.entries(map)) {
            result[tier] = [...names].sort()
        }
        return result
    }, [allTeams])

    const STEPS = [
        { title: 'Team', subtitle: 'Select Your Team' },
        { title: 'Date', subtitle: 'Choose a Date' },
        { title: 'Time', subtitle: 'Set Time (ET)' },
        { title: 'Settings', subtitle: 'Pick Mode & Bans' },
        { title: 'Opponent', subtitle: 'Challenge & Tiers' },
        { title: 'Region', subtitle: 'Region & Confirmation' },
        { title: 'Review', subtitle: 'Notes & Confirm' },
    ]

    const canAdvance = () => {
        if (step === 0) {
            if (!teamId) return false
            const team = captainTeams.find(t => t.teamId === Number(teamId))
            if (team?.isCommunityTeam && !team.eligible) return false
            return true
        }
        if (step === 1) return !!selectedDate
        if (step === 4) return filterMode === 'tier' ? acceptableTiers.length > 0 : acceptableDivisions.length > 0
        return true
    }

    const handleDateSelect = (dateStr, hasScrim) => {
        if (hasScrim) {
            setShowConflictDialog(dateStr)
        } else {
            setSelectedDate(dateStr)
        }
    }

    const confirmConflictDate = () => {
        setSelectedDate(showConflictDialog)
        setShowConflictDialog(null)
    }

    const toggleTier = (tier) => {
        setAcceptableTiers(prev =>
            prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier].sort((a, b) => a - b)
        )
    }

    const toggleDivision = (divId) => {
        setAcceptableDivisions(prev =>
            prev.includes(divId) ? prev.filter(d => d !== divId) : [...prev, divId]
        )
    }

    // Group active divisions by league for display
    const divisionsByLeague = useMemo(() => {
        const map = {}
        for (const d of activeDivisions) {
            if (!map[d.leagueName]) map[d.leagueName] = []
            map[d.leagueName].push(d)
        }
        return map
    }, [activeDivisions])

    const assembleScheduledDate = () => {
        const h = Number(timeHour)
        const hour24 = timeAmPm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
        // Determine whether the selected date is in EST (-05:00) or EDT (-04:00)
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
            .formatToParts(new Date(`${selectedDate}T12:00:00Z`))
        const offset = parts.find(p => p.type === 'timeZoneName').value === 'EDT' ? '-04:00' : '-05:00'
        return `${selectedDate}T${String(hour24).padStart(2, '0')}:${timeMinute}:00${offset}`
    }

    const handleSubmit = async () => {
        setPosting(true)
        setPostError(null)
        try {
            const payload = {
                team_id: Number(teamId),
                scheduled_date: assembleScheduledDate(),
                pick_mode: pickMode,
                banned_content_league: bannedContentLeague || null,
                notes: notes || null,
                challenged_team_id: challengedTeamId ? Number(challengedTeamId) : null,
                acceptable_tiers: filterMode === 'tier' && acceptableTiers.length < 5 ? acceptableTiers : null,
                acceptable_divisions: filterMode === 'division' ? acceptableDivisions : null,
                region,
                requires_confirmation: requiresConfirmation,
                allow_community_teams: allowCommunityTeams,
            }
            if (isEdit) {
                await scrimService.update({ scrim_id: editScrim.id, ...payload })
            } else {
                await scrimService.create(payload)
            }
            setPostSuccess(true)
        } catch (err) {
            setPostError(err.message || (isEdit ? 'Failed to update scrim' : 'Failed to post scrim'))
        } finally {
            setPosting(false)
        }
    }

    const resetWizard = () => {
        setStep(0)
        setSelectedDate(null)
        setTimeHour('7'); setTimeMinute('00'); setTimeAmPm('PM')
        setPickMode('regular'); setBannedContentLeague('')
        setChallengedTeamId(''); setNotes('')
        setAcceptableTiers([1, 2, 3, 4, 5])
        setFilterMode('tier'); setAcceptableDivisions([])
        setRegion(captainTeams[0]?.leagueSlug === 'tanuki-smite-league' ? 'EU' : 'NA')
        setRequiresConfirmation(false); setAllowCommunityTeams(false)
        setTeamSearch(''); setShowTeamPicker(false)
        setPostError(null); setPostSuccess(false)
    }

    // Success screen
    if (postSuccess) {
        return (
            <div className="xp-wizard">
                <div className="xp-wizard-body" style={{ minHeight: 200 }}>
                    <div className="xp-wizard-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{ fontSize: 36 }}>&#9989;</div>
                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 14 }}>{isEdit ? 'Scrim Updated!' : 'Scrim Request Posted!'}</div>
                        <div className="xp-text xp-text-muted" style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
                            {isEdit ? 'Your scrim request has been updated.' : challengedTeamId ? 'Your challenge has been sent.' : 'Your open scrim request is now visible to all teams.'}
                        </div>
                        <div className="flex gap-2 mt-2">
                            {!isEdit && <button type="button" onClick={() => { resetWizard() }} className="xp-btn">Post Another</button>}
                            <button type="button" onClick={onSuccess} className="xp-btn xp-btn-primary">{isEdit ? 'Done' : 'View My Scrims'}</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="xp-wizard">
            <div className="xp-wizard-body">
                {/* Sidebar (hidden on mobile via CSS) */}
                <div className="xp-wizard-sidebar">
                    {STEPS.map((s, i) => (
                        <div key={i} className={`xp-wizard-step-item ${i === step ? 'xp-wizard-step-item-active' : i < step ? 'xp-wizard-step-item-done' : ''}`}>
                            <span className="xp-wizard-step-num">{i < step ? '✓' : i + 1}</span>
                            <span>{s.title}</span>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="xp-wizard-content">
                    {/* Mobile step indicator */}
                    <div className="xp-wizard-mobile-step">Step {step + 1} of {STEPS.length} — {STEPS[step].subtitle}</div>

                    {/* Step header */}
                    <div style={{ marginBottom: 10 }}>
                        <div className="xp-text" style={{ fontWeight: 700, fontSize: 13 }}>{STEPS[step].subtitle}</div>
                        <div className="xp-step-divider" style={{ height: 1, background: '#7f9db9', margin: '4px 0 8px' }} />
                    </div>

                    {/* ── Step 0: Team Selection ── */}
                    {step === 0 && (
                        <div>
                            <div className="xp-text xp-text-muted" style={{ marginBottom: 8, color: '#555' }}>
                                Welcome to the Scrim Request Wizard. Select the team you want to post a scrim for.
                            </div>
                            {captainTeams.length === 1 ? (
                                <div className="xp-team-card flex items-center gap-3 p-2" style={{ background: '#fff', border: '1px solid #c0c0c0' }}>
                                    <TeamLogo slug={captainTeams[0].teamSlug} name={captainTeams[0].teamName} size={28} color={captainTeams[0].teamColor} />
                                    <div>
                                        <div className="xp-text flex items-center gap-2" style={{ fontWeight: 700, fontSize: 13 }}>
                                            {captainTeams[0].teamName}
                                            {captainTeams[0].isCommunityTeam && <span style={{ fontSize: 9, padding: '1px 5px', background: '#e0c8ff', color: '#5a2d82', borderRadius: 3, fontWeight: 600 }}>Community</span>}
                                            {captainTeams[0].isCommunityTeam && <span style={{ fontSize: 9, color: '#888' }}>({captainTeams[0].memberCount}/5 players)</span>}
                                        </div>
                                        <div className="xp-text xp-text-muted" style={{ fontSize: 10, color: '#666' }}>{captainTeams[0].leagueName}</div>
                                    </div>
                                </div>
                            ) : (
                                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="xp-select w-full" style={{ fontSize: 12, padding: '4px 6px' }}>
                                    {captainTeams.map(t => (
                                        <option key={t.teamId} value={t.teamId} disabled={t.isCommunityTeam && !t.eligible}>
                                            {t.teamName} ({t.isCommunityTeam ? `Community · ${t.memberCount}/5 players` : `${t.leagueName} - ${t.divisionName}`})
                                        </option>
                                    ))}
                                </select>
                            )}
                            {selectedTeam?.isCommunityTeam && !selectedTeam.eligible && (
                                <div className="xp-info-box-warn" style={{ marginTop: 8, padding: '8px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} />
                                    Your community team needs at least 5 active players to post scrims. Invite more players to get started.
                                </div>
                            )}
                            {selectedTeam && (
                                <div className="xp-division-preview flex items-center gap-3 mt-3 p-2" style={{ background: '#e8f0ff', border: '1px solid #7f9db9' }}>
                                    {tierImg && <img src={tierImg} alt="" style={{ width: 32, height: 32 }} />}
                                    <div>
                                        <div className="xp-text xp-division-preview-title" style={{ fontWeight: 700, color: '#0054e3' }}>
                                            {selectedTeam.divisionName}
                                        </div>
                                        <div className="xp-text xp-text-muted" style={{ fontSize: 10, color: '#555' }}>
                                            {selectedTeam.divisionTier ? `Tier ${selectedTeam.divisionTier} — ${RANK_LABELS[selectedTeam.divisionTier] || ''}` : 'No tier assigned'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 1: Date Selection ── */}
                    {step === 1 && (
                        <div>
                            <div className="xp-text xp-text-muted" style={{ marginBottom: 8, color: '#555' }}>
                                Choose a date for your scrim. Days with an orange dot have existing team scrims.
                            </div>
                            <XpCalendar selectedDate={selectedDate} onSelectDate={handleDateSelect} scrimDates={scrimDates} />
                            {selectedDate && (
                                <div className="xp-text xp-selected-date" style={{ textAlign: 'center', marginTop: 6, fontWeight: 700, color: '#0054e3' }}>
                                    Selected: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: Time Selection ── */}
                    {step === 2 && (
                        <div>
                            <div className="xp-text xp-text-muted" style={{ marginBottom: 8, color: '#555' }}>
                                Set the start time for your scrim.
                            </div>
                            <div className="flex items-center justify-center gap-2 my-4">
                                <Clock size={20} style={{ color: '#0054e3' }} />
                                <select value={timeHour} onChange={e => setTimeHour(e.target.value)} className="xp-time-select">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                        <option key={h} value={String(h)}>{h}</option>
                                    ))}
                                </select>
                                <span className="xp-time-colon">:</span>
                                <select value={timeMinute} onChange={e => setTimeMinute(e.target.value)} className="xp-time-select">
                                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <select value={timeAmPm} onChange={e => setTimeAmPm(e.target.value)} className="xp-time-select" style={{ width: 56 }}>
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                </select>
                            </div>
                            <div className="xp-info-box xp-info-box-warn flex items-center gap-2 p-2 mt-2" style={{ background: '#fffff0', border: '1px solid #c0a030' }}>
                                <AlertTriangle size={14} style={{ color: '#c08030', flexShrink: 0 }} />
                                <span className="xp-text xp-info-box-text" style={{ fontSize: 11, color: '#604000' }}>
                                    All times are in <strong>Eastern Time (ET)</strong>. Enter the time as you would read a clock in ET.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Game Settings ── */}
                    {step === 3 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Pick Mode</legend>
                                <div className="flex flex-col gap-1">
                                    {PICK_MODES.map(mode => (
                                        <label key={mode.value} className="xp-radio-label">
                                            <input type="radio" name="wiz_pick_mode" checked={pickMode === mode.value}
                                                onChange={() => setPickMode(mode.value)} className="xp-radio" />
                                            <span className="xp-text">{mode.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Banned Content League</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Select a league whose banned content rules apply to this scrim.
                                </div>
                                <select value={bannedContentLeague} onChange={e => setBannedContentLeague(e.target.value)} className="xp-select w-full">
                                    <option value="">None (No bans)</option>
                                    {leagues.map(l => (
                                        <option key={l.id} value={l.name}>{l.name}</option>
                                    ))}
                                </select>
                            </fieldset>
                        </div>
                    )}

                    {/* ── Step 4: Opponent & Tiers ── */}
                    {step === 4 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Challenge a Team (optional)</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Leave empty for an open request visible to all teams.
                                </div>
                                {challengedTeam ? (
                                    <div className="xp-challenged-team flex items-center gap-2 p-1.5" style={{ background: '#e0c8ff', border: '1px solid #8055c0' }}>
                                        <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={20} color={challengedTeam.color} />
                                        <div className="flex-1">
                                            <div className="xp-text xp-challenged-team-name" style={{ fontWeight: 700, color: '#400080' }}>{challengedTeam.name}</div>
                                            <div className="xp-text xp-text-muted" style={{ fontSize: 10, color: '#666' }}>{challengedTeam.leagueName} &middot; {challengedTeam.divisionName}</div>
                                        </div>
                                        <button type="button" onClick={() => { setChallengedTeamId(''); setTeamSearch('') }} className="xp-btn" style={{ padding: '1px 6px', fontSize: 10 }}>X</button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input type="text" value={teamSearch} onChange={e => { setTeamSearch(e.target.value); setShowTeamPicker(true) }}
                                            onFocus={() => setShowTeamPicker(true)} placeholder="Search for a team..." className="xp-input w-full" />
                                        {showTeamPicker && teamSearch && (
                                            <div className="xp-listbox absolute z-10 w-full" style={{ maxHeight: 160, overflowY: 'auto' }}>
                                                {filteredChallengeTeams.slice(0, 20).map(team => (
                                                    <button key={team.id} type="button" onClick={() => { setChallengedTeamId(String(team.id)); setShowTeamPicker(false); setTeamSearch('') }} className="xp-listbox-item">
                                                        <TeamLogo slug={team.slug} name={team.name} size={16} color={team.color} />
                                                        <div>
                                                            <div className="xp-text" style={{ fontWeight: 500 }}>{team.name}</div>
                                                            <div className="xp-text" style={{ fontSize: 10, color: '#666' }}>{team.leagueName} &middot; {team.divisionName}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {filteredChallengeTeams.length === 0 && (
                                                    <div className="xp-text" style={{ padding: '4px 8px', fontSize: 11, color: '#666' }}>No teams found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Acceptable Opponents</legend>
                                <div className="flex gap-2 mb-2">
                                    <button type="button" onClick={() => setFilterMode('tier')}
                                        className={`xp-btn ${filterMode === 'tier' ? 'xp-btn-primary' : ''}`}
                                        style={{ fontSize: 10, padding: '2px 10px' }}>
                                        Filter by Tier
                                    </button>
                                    <button type="button" onClick={() => setFilterMode('division')}
                                        className={`xp-btn ${filterMode === 'division' ? 'xp-btn-primary' : ''}`}
                                        style={{ fontSize: 10, padding: '2px 10px' }}>
                                        Filter by Division
                                    </button>
                                </div>

                                {filterMode === 'tier' && (
                                    <>
                                        <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                            Select which division tiers you are willing to accept scrims from.
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {[1, 2, 3, 4, 5, 6, 7].map(tier => {
                                                const img = getDivisionImage(null, null, tier)
                                                return (
                                                    <label key={tier} className="xp-checkbox-label">
                                                        <input type="checkbox" checked={acceptableTiers.includes(tier)}
                                                            onChange={() => toggleTier(tier)} className="xp-checkbox" />
                                                        {img && <img src={img} alt="" style={{ width: 16, height: 16 }} />}
                                                        <span className="xp-text">
                                                            Tier {tier} — {RANK_LABELS[tier]}
                                                            {tierDivisions[tier] && <span style={{ color: '#666' }}> ({tierDivisions[tier].join(', ')})</span>}
                                                        </span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                        {acceptableTiers.length === 0 && (
                                            <div className="xp-text" style={{ fontSize: 10, color: '#800000', marginTop: 4 }}>
                                                You must select at least one tier.
                                            </div>
                                        )}
                                    </>
                                )}

                                {filterMode === 'division' && (
                                    <>
                                        <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                            Select which divisions you are willing to accept scrims from.
                                        </div>
                                        {Object.entries(divisionsByLeague).map(([leagueName, divs]) => (
                                            <div key={leagueName} style={{ marginBottom: 6 }}>
                                                <div className="xp-text" style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
                                                    {leagueName}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {divs.map(d => {
                                                        const img = d.tier ? getDivisionImage(null, null, d.tier) : null
                                                        return (
                                                            <label key={d.id} className="xp-checkbox-label">
                                                                <input type="checkbox" checked={acceptableDivisions.includes(d.id)}
                                                                    onChange={() => toggleDivision(d.id)} className="xp-checkbox" />
                                                                {img && <img src={img} alt="" style={{ width: 14, height: 14 }} />}
                                                                <span className="xp-text">
                                                                    {d.name}{d.tier ? ` (${RANK_LABELS[d.tier]})` : ''}
                                                                </span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                        {acceptableDivisions.length === 0 && (
                                            <div className="xp-text" style={{ fontSize: 10, color: '#800000', marginTop: 4 }}>
                                                You must select at least one division.
                                            </div>
                                        )}
                                    </>
                                )}
                            </fieldset>
                        </div>
                    )}

                    {/* ── Step 5: Region & Confirmation ── */}
                    {step === 5 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Region</legend>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                    Select the region for this scrim. This helps opponents find matches in their timezone.
                                </div>
                                <div className="flex gap-3">
                                    {['NA', 'EU'].map(r => (
                                        <label key={r} className="xp-radio-label">
                                            <input type="radio" name="wiz_region" checked={region === r}
                                                onChange={() => setRegion(r)} className="xp-radio" />
                                            <span className="xp-text">{r === 'NA' ? 'North America (NA)' : 'Europe (EU)'}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Confirmation Preference</legend>
                                <label className="xp-checkbox-label">
                                    <input type="checkbox" checked={requiresConfirmation}
                                        onChange={e => setRequiresConfirmation(e.target.checked)} className="xp-checkbox" />
                                    <span className="xp-text">Require my confirmation before accepting</span>
                                </label>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginTop: 2, marginLeft: 20 }}>
                                    When enabled, teams who accept your scrim must wait for you to confirm via the web or Discord DM before the scrim is official.
                                </div>
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Community Teams</legend>
                                <label className="xp-checkbox-label">
                                    <input type="checkbox" checked={allowCommunityTeams}
                                        onChange={e => {
                                            setAllowCommunityTeams(e.target.checked)
                                            if (e.target.checked && !requiresConfirmation) setRequiresConfirmation(true)
                                        }} className="xp-checkbox" />
                                    <span className="xp-text">Allow Community Teams to accept</span>
                                </label>
                                <div className="xp-text" style={{ fontSize: 10, color: '#666', marginTop: 2, marginLeft: 20 }}>
                                    When enabled, non-league community teams can accept this scrim.
                                    {allowCommunityTeams && !requiresConfirmation && ' Confirmation is recommended.'}
                                </div>
                                {allowCommunityTeams && (
                                    <div className="xp-text" style={{ fontSize: 10, color: '#806000', marginTop: 4, marginLeft: 20, fontStyle: 'italic' }}>
                                        Confirmation was auto-enabled — you'll review community team acceptors before confirming.
                                    </div>
                                )}
                            </fieldset>
                        </div>
                    )}

                    {/* ── Step 6: Notes & Review ── */}
                    {step === 6 && (
                        <div>
                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Notes (optional)</legend>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional details..." rows={2} maxLength={500}
                                    className="xp-input w-full" style={{ resize: 'none' }} />
                            </fieldset>

                            <fieldset className="xp-fieldset">
                                <legend className="xp-fieldset-legend">Review</legend>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Team:</span>
                                        {selectedTeam && <TeamLogo slug={selectedTeam.teamSlug} name={selectedTeam.teamName} size={16} color={selectedTeam.teamColor} />}
                                        <span className="xp-text">{selectedTeam?.teamName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Division:</span>
                                        <span className="xp-text">{selectedTeam?.divisionName} ({RANK_LABELS[selectedTeam?.divisionTier] || 'N/A'})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Date:</span>
                                        <span className="xp-text">
                                            {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Time:</span>
                                        <span className="xp-text">{timeHour}:{timeMinute} {timeAmPm} ET</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Pick Mode:</span>
                                        <span className={`xp-badge ${XP_PICK_BADGE[pickMode] || 'xp-badge-blue'}`}>{formatPickMode(pickMode)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Bans:</span>
                                        <span className="xp-text">{bannedContentLeague || 'None'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Region:</span>
                                        <span className="xp-text">{region}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Confirm:</span>
                                        <span className="xp-text">{requiresConfirmation ? 'Required' : 'Auto-accept'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Community:</span>
                                        <span className="xp-text">{allowCommunityTeams ? 'Allowed' : 'Not allowed'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Opponent:</span>
                                        {challengedTeam ? (
                                            <span className="flex items-center gap-1">
                                                <TeamLogo slug={challengedTeam.slug} name={challengedTeam.name} size={14} color={challengedTeam.color} />
                                                <span className="xp-text" style={{ color: '#400080' }}>{challengedTeam.name}</span>
                                            </span>
                                        ) : (
                                            <span className="xp-text" style={{ color: '#555' }}>Open Request</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>
                                            {filterMode === 'tier' ? 'Tiers:' : 'Divisions:'}
                                        </span>
                                        <span className="xp-text">
                                            {filterMode === 'tier'
                                                ? (acceptableTiers.length === 7 ? 'All tiers' : acceptableTiers.map(t => RANK_LABELS[t]).join(', '))
                                                : acceptableDivisions.map(id => activeDivisions.find(d => d.id === id)?.name).filter(Boolean).join(', ')
                                            }
                                        </span>
                                    </div>
                                    {notes && (
                                        <div className="flex items-start gap-2">
                                            <span className="xp-text" style={{ fontWeight: 700, width: 70, flexShrink: 0 }}>Notes:</span>
                                            <span className="xp-text" style={{ color: '#555' }}>{notes}</span>
                                        </div>
                                    )}
                                </div>
                            </fieldset>

                            {postError && (
                                <div className="xp-info-box xp-info-box-error flex items-center gap-2 mb-2 p-2" style={{ background: '#ffc8c8', border: '1px solid #c05555' }}>
                                    <div className="xp-error-icon" style={{ width: 16, height: 16, fontSize: 9 }}>X</div>
                                    <span className="xp-text xp-info-box-text" style={{ fontSize: 11, color: '#800000' }}>{postError}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer navigation */}
            <div className="xp-wizard-footer">
                <div>
                    {step > (isEdit ? 1 : 0) && (
                        <button type="button" onClick={() => setStep(s => s - 1)} className="xp-btn">
                            &lt; Back
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    {step < 6 ? (
                        <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="xp-btn xp-btn-primary">
                            Next &gt;
                        </button>
                    ) : (
                        <button type="button" onClick={handleSubmit} disabled={posting || !canAdvance()} className="xp-btn xp-btn-primary">
                            {posting ? (isEdit ? 'Saving...' : 'Posting...') : (isEdit ? 'Save Changes' : 'Finish')}
                        </button>
                    )}
                    <button type="button" onClick={() => setShowCancelDialog(true)} className="xp-btn">Cancel</button>
                </div>
            </div>

            {/* Conflict warning dialog */}
            {showConflictDialog && (
                <XpDialog title="Schedule Conflict" icon="⚠️" onClose={() => setShowConflictDialog(null)}>
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={28} style={{ color: '#c08030', flexShrink: 0 }} />
                        <div>
                            <div className="xp-text" style={{ fontWeight: 700, marginBottom: 4 }}>Your team already has a scrim on this date.</div>
                            <div className="xp-text" style={{ fontSize: 11, color: '#555' }}>
                                Are you sure you want to schedule another scrim on {new Date(showConflictDialog + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}?
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                        <button type="button" onClick={confirmConflictDate} className="xp-btn xp-btn-primary">Yes</button>
                        <button type="button" onClick={() => setShowConflictDialog(null)} className="xp-btn">No</button>
                    </div>
                </XpDialog>
            )}

            {/* Cancel confirmation dialog */}
            {showCancelDialog && (
                <XpDialog title="Cancel Wizard" icon="❓" onClose={() => setShowCancelDialog(false)}>
                    <div className="xp-text" style={{ marginBottom: 8 }}>
                        Are you sure you want to cancel? All entered information will be lost.
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setShowCancelDialog(false); resetWizard(); onCancel?.() }} className="xp-btn xp-btn-danger">Yes, Cancel</button>
                        <button type="button" onClick={() => setShowCancelDialog(false)} className="xp-btn">No, Continue</button>
                    </div>
                </XpDialog>
            )}
        </div>
    )
}
