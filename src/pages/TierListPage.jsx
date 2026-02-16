// src/pages/TierListPage.jsx — Standalone tier list with league/division/season selectors
import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import DivisionContext from '../context/DivisionContext'
import DragDropRankings from '../components/DragDropRankings'
import { leagueService, teamService, playerService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { ChevronDown, Lock, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// League logos
import aglLogo from '../assets/leagues/agl.png'
import babylonLogo from '../assets/leagues/babylon.png'
import oslLogo from '../assets/leagues/osl.png'

import { getDivisionImage } from '../utils/divisionImages'

const LEAGUE_LOGOS = {
    'agl': aglLogo,
    'albion-giants-league': aglLogo,
    'bsl': babylonLogo,
    'babylon-smite-league': babylonLogo,
    'osl': oslLogo,
    'olympian-smite-league': oslLogo,
}

// Custom dropdown component with icon support
function FancySelect({ value, onChange, options, placeholder, renderOption, renderSelected, disabled }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    const selected = options.find(o => o.value === value)

    return (
        <div ref={ref} className="relative flex-1 min-w-0">
            <button
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-sm text-left ${
                    open ? 'border-(--color-accent)/50 bg-(--color-secondary)' : 'border-white/10 bg-(--color-secondary) hover:border-white/20'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {selected ? renderSelected(selected) : (
                        <span className="text-(--color-text-secondary)">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-(--color-text-secondary) shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-(--color-secondary) border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => { onChange(option.value); setOpen(false) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                                option.value === value
                                    ? 'bg-(--color-accent)/10 text-(--color-accent)'
                                    : 'text-(--color-text) hover:bg-white/5'
                            }`}
                        >
                            {renderOption(option)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function TierListPage() {
    const { hasAnyPermission } = useAuth()
    const canPreview = hasAnyPermission
    const [leagues, setLeagues] = useState([])
    const [leaguesLoading, setLeaguesLoading] = useState(true)
    const [showPicker, setShowPicker] = useState(true)

    const [selectedLeagueSlug, setSelectedLeagueSlug] = useState('')
    const [selectedDivisionSlug, setSelectedDivisionSlug] = useState('')
    const [selectedSeasonId, setSelectedSeasonId] = useState('')

    const [teams, setTeams] = useState([])
    const [players, setPlayers] = useState([])
    const [dataLoading, setDataLoading] = useState(false)
    const [error, setError] = useState(null)

    // Load all leagues with full division/season data on mount
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const allBasic = await leagueService.getAll()
                if (cancelled) return
                const detailed = await Promise.all(
                    allBasic.map(l => leagueService.getBySlug(l.slug))
                )
                if (cancelled) return
                setLeagues(detailed.filter(l => l.divisions?.length > 0 && l.name?.toLowerCase() !== 'test league'))
            } catch (err) {
                console.error('Failed to load leagues:', err)
            } finally {
                if (!cancelled) setLeaguesLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const hasActiveSeason = (league) =>
        league.divisions?.some(d => d.seasons?.some(s => s.is_active || canPreview))

    const activeLeagues = useMemo(
        () => leagues.filter(hasActiveSeason),
        [leagues]
    )

    const pickLeague = (league) => {
        if (!hasActiveSeason(league)) return
        setSelectedLeagueSlug(league.slug)
        setShowPicker(false)
    }

    const selectedLeague = useMemo(
        () => activeLeagues.find(l => l.slug === selectedLeagueSlug) || null,
        [activeLeagues, selectedLeagueSlug]
    )

    const activeDivisions = useMemo(
        () => selectedLeague?.divisions?.filter(d => d.seasons?.some(s => s.is_active || canPreview)) || [],
        [selectedLeague]
    )

    useEffect(() => {
        if (activeDivisions.length > 0) {
            setSelectedDivisionSlug(activeDivisions[0].slug)
        } else {
            setSelectedDivisionSlug('')
        }
    }, [activeDivisions])

    const selectedDivision = useMemo(
        () => activeDivisions.find(d => d.slug === selectedDivisionSlug) || null,
        [activeDivisions, selectedDivisionSlug]
    )

    const activeSeasons = useMemo(
        () => selectedDivision?.seasons?.filter(s => s.is_active || canPreview) || [],
        [selectedDivision]
    )

    useEffect(() => {
        if (activeSeasons.length > 0) {
            setSelectedSeasonId(String(activeSeasons[0].id))
        } else {
            setSelectedSeasonId('')
        }
    }, [activeSeasons])

    const selectedSeason = useMemo(
        () => activeSeasons.find(s => String(s.id) === selectedSeasonId) || null,
        [activeSeasons, selectedSeasonId]
    )

    useEffect(() => {
        if (!selectedSeason) {
            setTeams([])
            setPlayers([])
            return
        }

        let cancelled = false
        const fetchData = async () => {
            setDataLoading(true)
            setError(null)
            try {
                const [t, p] = await Promise.all([
                    teamService.getAllBySeason(selectedSeason.id),
                    playerService.getAllBySeason(selectedSeason.id),
                ])
                if (cancelled) return
                setTeams(t)
                setPlayers(p)
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to load division data:', err)
                    setError(err.message)
                }
            } finally {
                if (!cancelled) setDataLoading(false)
            }
        }
        fetchData()
        return () => { cancelled = true }
    }, [selectedSeason])

    const contextValue = useMemo(() => ({
        league: selectedLeague,
        division: selectedDivision,
        season: selectedSeason ? {
            ...selectedSeason,
            division_id: selectedDivision?.id,
            division_name: selectedDivision?.name,
            division_slug: selectedDivision?.slug,
        } : null,
        teams,
        players,
        loading: dataLoading,
        error,
    }), [selectedLeague, selectedDivision, selectedSeason, teams, players, dataLoading, error])

    // Build dropdown options
    const leagueOptions = activeLeagues.map(l => ({
        value: l.slug,
        label: l.name,
        logo: LEAGUE_LOGOS[l.slug],
    }))

    const divisionOptions = activeDivisions.map(d => ({
        value: d.slug,
        label: d.name,
        rankImg: getDivisionImage(selectedLeagueSlug, d.slug, d.tier),
        tier: d.tier,
    }))

    const seasonOptions = activeSeasons.map(s => ({
        value: String(s.id),
        label: s.name,
        isActive: s.is_active,
    }))

    if (leaguesLoading) {
        return (
            <>
                <Navbar title="Tier Lists" />
                <div className="max-w-7xl mx-auto pt-24 pb-16 px-4 text-center">
                    <div className="w-8 h-8 border-2 border-(--color-accent) border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            </>
        )
    }

    return (
        <>
        <Navbar title="Tier Lists" />
        <div className="max-w-7xl mx-auto pt-24 pb-6 px-4 sm:px-6 lg:px-8">
            <PageTitle title="SMITE 2 Player Tier List Maker" description="Create and share SMITE 2 player tier lists. Drag-and-drop players by role, export as images, and compare your rankings with the community." />
            {/* League picker modal */}
            {showPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
                        <h2 className="font-heading text-xl sm:text-2xl font-bold text-(--color-text) text-center mb-2">
                            Select a League
                        </h2>
                        <p className="text-sm text-(--color-text-secondary) text-center mb-6">
                            Choose a league to build your tier list
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {leagues.map(league => {
                                const active = hasActiveSeason(league)
                                const logo = LEAGUE_LOGOS[league.slug]
                                return (
                                    <button
                                        key={league.slug}
                                        onClick={() => pickLeague(league)}
                                        disabled={!active}
                                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                                            active
                                                ? 'border-white/10 hover:border-(--color-accent)/50 hover:bg-white/5 cursor-pointer'
                                                : 'border-white/5 opacity-40 cursor-not-allowed'
                                        }`}
                                    >
                                        {!active && (
                                            <div className="absolute top-2 right-2">
                                                <Lock className="w-3.5 h-3.5 text-(--color-text-secondary)" />
                                            </div>
                                        )}
                                        {logo ? (
                                            <img src={logo} alt="" className="w-14 h-14 object-contain" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-lg font-bold text-(--color-text-secondary)">
                                                {league.name?.[0]}
                                            </div>
                                        )}
                                        <span className={`text-xs font-medium text-center leading-tight ${active ? 'text-(--color-text)' : 'text-(--color-text-secondary)'}`}>
                                            {league.name}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-6 text-center">
                            <Link to="/" className="text-xs text-(--color-text-secondary) hover:text-(--color-text) transition-colors">
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Selector bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {/* League selector */}
                {leagueOptions.length > 1 ? (
                    <FancySelect
                        value={selectedLeagueSlug}
                        onChange={setSelectedLeagueSlug}
                        options={leagueOptions}
                        placeholder="Select league"
                        renderSelected={(opt) => (
                            <>
                                {opt.logo ? (
                                    <img src={opt.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">{opt.label[0]}</div>
                                )}
                                <span className="text-(--color-text) font-medium truncate">{opt.label}</span>
                            </>
                        )}
                        renderOption={(opt) => (
                            <>
                                {opt.logo ? (
                                    <img src={opt.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">{opt.label[0]}</div>
                                )}
                                <span className="truncate">{opt.label}</span>
                            </>
                        )}
                    />
                ) : leagueOptions.length === 1 && (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-(--color-secondary) border border-white/10 text-sm">
                        {leagueOptions[0].logo && <img src={leagueOptions[0].logo} alt="" className="w-5 h-5 object-contain" />}
                        <span className="text-(--color-text) font-medium">{leagueOptions[0].label}</span>
                    </div>
                )}

                {/* Division selector */}
                {divisionOptions.length > 1 ? (
                    <FancySelect
                        value={selectedDivisionSlug}
                        onChange={setSelectedDivisionSlug}
                        options={divisionOptions}
                        placeholder="Select division"
                        renderSelected={(opt) => (
                            <>
                                {opt.rankImg ? (
                                    <img src={opt.rankImg} alt="" className="w-5 h-5 object-contain shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded bg-white/10 shrink-0" />
                                )}
                                <span className="text-(--color-text) font-medium truncate">{opt.label}</span>
                            </>
                        )}
                        renderOption={(opt) => (
                            <>
                                {opt.rankImg ? (
                                    <img src={opt.rankImg} alt="" className="w-5 h-5 object-contain shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded bg-white/10 shrink-0" />
                                )}
                                <span className="truncate">{opt.label}</span>
                            </>
                        )}
                    />
                ) : divisionOptions.length === 1 && (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-(--color-secondary) border border-white/10 text-sm">
                        {divisionOptions[0].rankImg && <img src={divisionOptions[0].rankImg} alt="" className="w-5 h-5 object-contain" />}
                        <span className="text-(--color-text) font-medium">{divisionOptions[0].label}</span>
                    </div>
                )}

                {/* Season selector */}
                {seasonOptions.length > 1 ? (
                    <FancySelect
                        value={selectedSeasonId}
                        onChange={setSelectedSeasonId}
                        options={seasonOptions}
                        placeholder="Select season"
                        renderSelected={(opt) => (
                            <>
                                <Calendar className="w-4 h-4 text-(--color-text-secondary) shrink-0" />
                                <span className="text-(--color-text) font-medium truncate">{opt.label}</span>
                            </>
                        )}
                        renderOption={(opt) => (
                            <>
                                <Calendar className="w-4 h-4 text-(--color-text-secondary) shrink-0" />
                                <span className="truncate">{opt.label}</span>
                                {opt.isActive && (
                                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-400">Active</span>
                                )}
                            </>
                        )}
                    />
                ) : seasonOptions.length === 1 && (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-(--color-secondary) border border-white/10 text-sm">
                        <Calendar className="w-4 h-4 text-(--color-text-secondary)" />
                        <span className="text-(--color-text) font-medium">{seasonOptions[0].label}</span>
                    </div>
                )}
            </div>

            {/* Tier list */}
            {selectedSeason && (
                <DivisionContext.Provider value={contextValue} key={selectedSeasonId}>
                    <DragDropRankings divisionSlug={selectedDivisionSlug} />
                </DivisionContext.Provider>
            )}

            {!selectedSeason && !showPicker && (
                <div className="text-center py-16 text-(--color-text-secondary)">
                    No active seasons available.
                </div>
            )}
        </div>
        </>
    )
}
