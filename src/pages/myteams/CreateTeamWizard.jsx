import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Check, ChevronLeft, ChevronRight, Link2, Copy, Search, Users } from 'lucide-react'
import ImageUpload from '../../components/ImageUpload'
import { RANK_LABELS, getDivisionImage } from '../../utils/divisionImages'
import { communityTeamService } from '../../services/database'

const STEPS = [
    { title: 'Team Info', subtitle: 'Name & Logo' },
    { title: 'Skill Tier', subtitle: 'Competitive Level' },
    { title: 'Invite', subtitle: 'Add Members' },
]

const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#a855f7',
]

const TIER_DESCRIPTIONS = {
    1: 'Top-level competitive play',
    2: 'High-level competitive play',
    3: 'Intermediate competitive play',
    4: 'Developing competitive play',
    5: 'Entry-level competitive play',
}

export default function CreateTeamWizard({ onSuccess, onClose }) {
    const [step, setStep] = useState(0)

    // Step 0: Team Info
    const [name, setName] = useState('')
    const [color, setColor] = useState('#6366f1')
    const [logoFile, setLogoFile] = useState(null)
    const [logoError, setLogoError] = useState(null)

    // Step 1: Skill Tier
    const [skillTier, setSkillTier] = useState(null)
    const [allDivisions, setAllDivisions] = useState({}) // { tier: [divisions] }

    // Step 2: Invites
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [invitees, setInvitees] = useState([])
    const [inviteLink, setInviteLink] = useState(null)
    const [linkCopied, setLinkCopied] = useState(false)

    // Submit
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [success, setSuccess] = useState(false)

    // Fetch divisions for all tiers upfront
    useEffect(() => {
        Promise.all([1, 2, 3, 4, 5].map(tier =>
            communityTeamService.getDivisionsByTier(tier)
                .then(data => ({ tier, divisions: data.divisions || [] }))
                .catch(() => ({ tier, divisions: [] }))
        )).then(results => {
            const map = {}
            for (const { tier, divisions } of results) map[tier] = divisions
            setAllDivisions(map)
        })
    }, [])

    // Debounced user search
    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); return }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                const data = await communityTeamService.searchUsers(searchQuery)
                // Filter out already-invited users
                const invitedIds = new Set(invitees.map(u => u.id))
                setSearchResults((data.users || []).filter(u => !invitedIds.has(u.id)))
            } catch {
                setSearchResults([])
            } finally {
                setSearching(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, invitees])

    const canAdvance = useCallback(() => {
        if (step === 0) return name.trim().length >= 2
        if (step === 1) return !!skillTier
        return true
    }, [step, name, skillTier])

    const addInvitee = (user) => {
        setInvitees(prev => [...prev, user])
        setSearchQuery('')
        setSearchResults([])
    }

    const removeInvitee = (userId) => {
        setInvitees(prev => prev.filter(u => u.id !== userId))
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        setSubmitError(null)
        try {
            // 1. Create team
            const { team } = await communityTeamService.create({
                name: name.trim(),
                skill_tier: skillTier,
                color,
            })

            // 2. Upload logo if provided
            if (logoFile) {
                try {
                    await communityTeamService.uploadLogo(team.id, logoFile)
                } catch (err) {
                    console.error('Logo upload failed:', err)
                }
            }

            // 3. Send invites
            for (const invitee of invitees) {
                try {
                    await communityTeamService.invite(team.id, invitee.id)
                } catch (err) {
                    console.error(`Invite failed for ${invitee.discord_username}:`, err)
                }
            }

            // 4. Generate invite link if requested
            if (inviteLink === 'pending') {
                try {
                    const { invite_code } = await communityTeamService.generateLink(team.id)
                    setInviteLink(`${window.location.origin}/team?join=${invite_code}`)
                } catch {
                    setInviteLink(null)
                }
            }

            setSuccess(true)
        } catch (err) {
            setSubmitError(err.message || 'Failed to create team')
        } finally {
            setSubmitting(false)
        }
    }

    const copyLink = async () => {
        if (!inviteLink || inviteLink === 'pending') return
        try {
            await navigator.clipboard.writeText(inviteLink)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        } catch {}
    }

    // Success screen
    if (success) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full bg-(--color-secondary) p-6">
                    <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-7 h-7 text-green-400" />
                        </div>
                        <h3 className="text-lg font-bold text-(--color-text) mb-2">Team Created!</h3>
                        <p className="text-sm text-(--color-text-secondary) mb-1">
                            <span className="font-semibold text-(--color-text)">{name}</span> is ready to go.
                        </p>
                        {invitees.length > 0 && (
                            <p className="text-xs text-(--color-text-secondary) mb-4">
                                {invitees.length} invite{invitees.length !== 1 ? 's' : ''} sent.
                            </p>
                        )}
                        {inviteLink && inviteLink !== 'pending' && (
                            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="text-[10px] uppercase tracking-widest text-(--color-text-secondary) mb-1">Invite Link</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={inviteLink}
                                        className="flex-1 text-xs bg-transparent text-(--color-text) outline-none truncate"
                                    />
                                    <button onClick={copyLink} className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-text) transition-colors cursor-pointer">
                                        {linkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={onSuccess}
                            className="px-6 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] font-semibold hover:opacity-90 transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-lg w-full bg-(--color-secondary) flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-(--color-text)">Create Your Team</h2>
                        <div className="text-xs text-(--color-text-secondary) mt-0.5">
                            Step {step + 1} of {STEPS.length} — {STEPS[step].subtitle}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex px-5 pt-3 gap-2">
                    {STEPS.map((s, i) => (
                        <div key={i} className="flex-1">
                            <div className={`h-1 rounded-full transition-colors ${
                                i < step ? 'bg-[var(--color-accent)]' : i === step ? 'bg-[var(--color-accent)]/60' : 'bg-white/10'
                            }`} />
                            <div className={`text-[10px] mt-1 ${i <= step ? 'text-(--color-accent)' : 'text-(--color-text-secondary)/50'}`}>
                                {s.title}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 panel-scrollbar">
                    {/* Step 0: Name & Logo */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    maxLength={50}
                                    placeholder="Enter your team name"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                    autoFocus
                                />
                                <div className="text-[10px] text-(--color-text-secondary) mt-1">{name.length}/50</div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Logo</label>
                                <div className="flex items-start gap-4">
                                    <ImageUpload
                                        file={logoFile}
                                        onChange={setLogoFile}
                                        onError={setLogoError}
                                        size={80}
                                        maxDim={256}
                                    />
                                    <div className="text-xs text-(--color-text-secondary) space-y-1 pt-1">
                                        <p>Square images work best (1:1 ratio).</p>
                                        <p>Images with a <span className="text-(--color-text)">transparent background</span> will look better.</p>
                                        <p className="text-[10px]">Auto-resized to 256x256. Max 10MB input.</p>
                                    </div>
                                </div>
                                {logoError && (
                                    <div className="mt-2 text-xs text-red-400">{logoError}</div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-(--color-text) mb-1.5">Team Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLOR_PRESETS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className="w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110"
                                            style={{
                                                backgroundColor: c,
                                                outline: color === c ? '2px solid white' : '2px solid transparent',
                                                outlineOffset: '2px',
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-6 h-6 rounded" style={{ backgroundColor: color }} />
                                    <input
                                        type="text"
                                        value={color}
                                        onChange={e => {
                                            const v = e.target.value
                                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                                        }}
                                        maxLength={7}
                                        className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-(--color-text) font-mono focus:outline-none focus:border-(--color-accent)/50"
                                    />
                                    <span className="text-[10px] text-(--color-text-secondary)">Used as your team's accent color</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Skill Tier */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="p-3 rounded-lg bg-amber-900/15 border border-amber-500/20">
                                <p className="text-xs text-amber-300/90">
                                    This is your team's <span className="font-bold">competitive league skill level</span>, not your SMITE 2 ranked tier. Pick the level that best matches your team's organized play experience.
                                </p>
                            </div>

                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5].map(tier => {
                                    const img = getDivisionImage(null, null, tier)
                                    const selected = skillTier === tier
                                    const tierDivs = (allDivisions[tier] || []).filter(d => d.is_active)
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => setSkillTier(tier)}
                                            className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer text-left ${
                                                selected
                                                    ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10'
                                                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                                            }`}
                                        >
                                            {img && <img src={img} alt="" className="w-8 h-8 mt-0.5" />}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-semibold ${selected ? 'text-[var(--color-accent)]' : 'text-(--color-text)'}`}>
                                                        {RANK_LABELS[tier]}
                                                    </span>
                                                    <span className="text-[11px] text-(--color-text-secondary)">
                                                        {TIER_DESCRIPTIONS[tier]}
                                                    </span>
                                                </div>
                                                {tierDivs.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {tierDivs.map(d => (
                                                            <span key={d.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-(--color-text-secondary)">
                                                                {d.name} <span className="opacity-50">({d.league_name})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {selected && (
                                                <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check className="w-3 h-3 text-[var(--color-primary)]" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Invite Members */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-xs text-(--color-text-secondary)">
                                Invite players to join your team. Search by Discord username or SMITE name. You can always invite more members later.
                            </p>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)/50" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by Discord or SMITE name..."
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                )}
                            </div>

                            {/* Search results */}
                            {searchResults.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-(--color-primary) max-h-48 overflow-y-auto panel-scrollbar">
                                    {searchResults.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => addInvitee(user)}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer text-left"
                                        >
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-[#5865F2] shrink-0 flex items-center justify-center">
                                                {user.discord_avatar && user.discord_id ? (
                                                    <img src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[9px] font-bold text-white">{user.discord_username?.[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-(--color-text) truncate">{user.discord_username}</div>
                                                {user.player_name && (
                                                    <div className="text-[10px] text-(--color-text-secondary) truncate">{user.player_name}</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Queued invitees */}
                            {invitees.length > 0 && (
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                                        Inviting ({invitees.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {invitees.map(user => (
                                            <div
                                                key={user.id}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10"
                                            >
                                                <div className="w-4 h-4 rounded-full overflow-hidden bg-[#5865F2] shrink-0 flex items-center justify-center">
                                                    {user.discord_avatar && user.discord_id ? (
                                                        <img src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[7px] font-bold text-white">{user.discord_username?.[0]?.toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-(--color-text)">{user.discord_username}</span>
                                                <button
                                                    onClick={() => removeInvitee(user.id)}
                                                    className="p-0.5 rounded-full hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Invite link section */}
                            <div className="border-t border-white/10 pt-4">
                                <div className="text-xs font-bold uppercase tracking-widest text-(--color-text-secondary) mb-2">
                                    Invite Link
                                </div>
                                <p className="text-xs text-(--color-text-secondary) mb-2">
                                    Generate a shareable link for players not yet on the site.
                                </p>
                                <button
                                    onClick={() => setInviteLink('pending')}
                                    disabled={inviteLink === 'pending'}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                                        inviteLink === 'pending'
                                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                                            : 'bg-white/5 border border-white/10 text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10'
                                    }`}
                                >
                                    <Link2 className="w-4 h-4" />
                                    {inviteLink === 'pending' ? 'Link will be generated after creation' : 'Generate invite link'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                    {submitError && (
                        <div className="text-xs text-red-400 flex-1 mr-3">{submitError}</div>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        {step > 0 && (
                            <button
                                onClick={() => setStep(s => s - 1)}
                                disabled={submitting}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 text-sm text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                        )}
                        {step < STEPS.length - 1 ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                disabled={!canAdvance()}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-40"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary)] text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-40"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" /> Create Team
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
