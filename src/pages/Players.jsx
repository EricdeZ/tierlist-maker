import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Users, Swords, Shield, Crosshair, Flame, Heart } from 'lucide-react'
import { globalPlayerService } from '../services/database'
import Navbar from '../components/layout/Navbar'
import PageTitle from '../components/PageTitle'
import smiteLogo from '../assets/smite2.png'

import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const ROLE_IMAGES = {
    'Solo': soloImage, 'SOLO': soloImage,
    'Jungle': jungleImage, 'JUNGLE': jungleImage,
    'Mid': midImage, 'MID': midImage,
    'Support': suppImage, 'SUPPORT': suppImage,
    'ADC': adcImage,
}

const ACCENT = '#6366f1'
const ACCENT_RGB = '99, 102, 241'

const formatBig = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return new Intl.NumberFormat().format(n)
}

const HighlightText = ({ text, query }) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-(--color-accent)/30 text-(--color-text) rounded-sm px-0.5">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}

// Seeded PRNG for stable layout
function seededRandom(seed) {
    let s = seed
    return () => {
        s = (s * 16807 + 0) % 2147483647
        return (s - 1) / 2147483646
    }
}

const FLOATING_COUNT = 35

function buildParticles(names) {
    if (names.length === 0) return []
    const rand = seededRandom(42)
    const shuffled = [...names]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return Array.from({ length: FLOATING_COUNT }, (_, i) => {
        const depth = rand()
        const goRight = rand() > 0.5
        const speed = depth < 0.2 ? 0.15 + rand() * 0.1
                    : depth < 0.5 ? 0.3 + rand() * 0.2
                    : depth < 0.8 ? 0.5 + rand() * 0.3
                    :               0.8 + rand() * 0.4
        return {
            name: shuffled[i % shuffled.length],
            y: rand() * 0.95,
            x: rand(), // initial progress 0–1
            fontSize: depth < 0.2 ? 8 + rand() * 4
                    : depth < 0.5 ? 13 + rand() * 6
                    : depth < 0.8 ? 22 + rand() * 10
                    :               34 + rand() * 14,
            opacity: depth < 0.2 ? 0.06 + rand() * 0.03
                   : depth < 0.5 ? 0.10 + rand() * 0.05
                   : depth < 0.8 ? 0.14 + rand() * 0.06
                   :               0.18 + rand() * 0.07,
            speed: goRight ? speed : -speed, // px per frame at 60fps
            fontWeight: depth > 0.7 ? '700' : depth > 0.4 ? '600' : '400',
        }
    })
}

function useFloatingCanvas(canvasRef, names) {
    const particlesRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || names.length === 0) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Build particles once
        if (!particlesRef.current || particlesRef.current._names !== names) {
            particlesRef.current = buildParticles(names)
            particlesRef.current._names = names
        }
        const particles = particlesRef.current

        let raf
        let lastTime = 0

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = canvas.offsetWidth * dpr
            canvas.height = canvas.offsetHeight * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        const draw = (time) => {
            const dt = lastTime ? (time - lastTime) / 16.67 : 1 // normalize to 60fps
            lastTime = time

            const w = canvas.offsetWidth
            const h = canvas.offsetHeight

            ctx.clearRect(0, 0, w, h)

            for (const p of particles) {
                // Move
                p.x += (p.speed * dt) / w

                // Wrap around
                if (p.speed > 0 && p.x > 1.15) p.x = -0.15
                else if (p.speed < 0 && p.x < -0.15) p.x = 1.15

                ctx.font = `${p.fontWeight} ${p.fontSize}px "Beaufort for LOL", "Segoe UI", system-ui, sans-serif`
                ctx.fillStyle = `rgba(${ACCENT_RGB}, ${p.opacity})`
                ctx.fillText(p.name, p.x * w, p.y * h)
            }

            raf = requestAnimationFrame(draw)
        }

        resize()
        raf = requestAnimationFrame(draw)
        window.addEventListener('resize', resize)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', resize)
        }
    }, [canvasRef, names])
}

export default function Players() {
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [playerNames, setPlayerNames] = useState([])
    const canvasRef = useRef(null)

    // Search state
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const containerRef = useRef(null)
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const debounceRef = useRef(null)

    useEffect(() => {
        globalPlayerService.getStats()
            .then(setStats)
            .catch(() => {})
            .finally(() => setLoading(false))
        globalPlayerService.getNames()
            .then(names => { if (names.length > 0) setPlayerNames(names) })
            .catch(() => {})
    }, [])

    useFloatingCanvas(canvasRef, playerNames)

    useEffect(() => {
        if (!isOpen) return
        const handle = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [isOpen])

    useEffect(() => {
        if (highlightIndex < 0 || !listRef.current) return
        const item = listRef.current.children[highlightIndex]
        if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [highlightIndex])

    const doSearch = useCallback((term) => {
        if (term.trim().length < 1) {
            setResults([])
            setIsOpen(false)
            return
        }
        setSearching(true)
        globalPlayerService.search(term.trim())
            .then(data => {
                setResults(data)
                setIsOpen(true)
            })
            .catch(() => setResults([]))
            .finally(() => setSearching(false))
    }, [])

    const handleChange = (e) => {
        const value = e.target.value
        setQuery(value)
        setHighlightIndex(-1)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => doSearch(value), 250)
    }

    const handleClear = () => {
        setQuery('')
        setResults([])
        setIsOpen(false)
        setHighlightIndex(-1)
        inputRef.current?.focus()
    }

    const navigateToPlayer = (player) => {
        navigate(`/profile/${player.slug}`)
        setIsOpen(false)
    }

    const handleKeyDown = (e) => {
        if (!isOpen || results.length === 0) {
            if (e.key === 'ArrowDown' && results.length > 0) {
                setIsOpen(true)
                setHighlightIndex(0)
                e.preventDefault()
            }
            return
        }
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightIndex(prev => prev < results.length - 1 ? prev + 1 : 0)
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightIndex(prev => prev > 0 ? prev - 1 : results.length - 1)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightIndex >= 0 && highlightIndex < results.length) {
                    navigateToPlayer(results[highlightIndex])
                }
                break
            case 'Escape':
                setIsOpen(false)
                setHighlightIndex(-1)
                inputRef.current?.blur()
                break
        }
    }

    const showDropdown = isOpen && query.length >= 1

    const statCards = stats ? [
        { label: 'Players', value: formatBig(stats.total_players), icon: Users },
        { label: 'Games Played', value: formatBig(stats.total_games), icon: Swords },
        { label: 'Total Kills', value: formatBig(stats.total_kills), icon: Crosshair },
        { label: 'Total Damage', value: formatBig(stats.total_damage), icon: Flame },
        { label: 'Total Mitigated', value: formatBig(stats.total_mitigated), icon: Shield },
        { label: 'Total Assists', value: formatBig(stats.total_assists), icon: Heart },
    ] : []

    return (
        <div className="relative min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Players" />
            <PageTitle title="Players" description="Search for players across all leagues. View aggregate stats and find player profiles." />

            {/* Background — single canvas + static gradient */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0"
                     style={{
                         background: `
                             radial-gradient(ellipse 50% 60% at 30% 40%, ${ACCENT}35, transparent 70%),
                             radial-gradient(ellipse 60% 45% at 70% 35%, ${ACCENT}25, transparent 65%),
                             radial-gradient(ellipse 55% 50% at 40% 75%, ${ACCENT}20, transparent 70%),
                             ${ACCENT}10
                         `,
                     }} />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                />
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 sm:px-6 pt-20 sm:pt-0 sm:justify-center">
                <div className="text-center mb-6 sm:mb-8">
                    <img src={smiteLogo} alt="SMITE 2 Companion" className="h-12 sm:h-18 w-auto mx-auto mb-3 sm:mb-4 drop-shadow-lg hidden sm:block" />
                    <h1 className="text-3xl sm:text-5xl font-bold font-heading mb-2 sm:mb-3">Player Directory</h1>
                    <p className="text-(--color-text-secondary) text-xs sm:text-base max-w-lg mx-auto">
                        Search across all leagues and seasons to find any player's profile, stats, and match history.
                    </p>
                </div>

                <div ref={containerRef} className="relative w-full max-w-2xl mb-6 sm:mb-10">
                    <div className="relative">
                        <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-(--color-text-secondary) pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            role="combobox"
                            aria-expanded={showDropdown && results.length > 0}
                            aria-autocomplete="list"
                            aria-controls="global-player-listbox"
                            aria-activedescendant={highlightIndex >= 0 ? `gp-option-${highlightIndex}` : undefined}
                            placeholder="Search players..."
                            value={query}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => { if (query.length >= 1 && results.length > 0) setIsOpen(true) }}
                            className="w-full pl-11 pr-11 py-3.5 sm:pl-14 sm:pr-14 sm:py-4.5 bg-(--color-secondary)/80 backdrop-blur-sm border border-white/15 rounded-2xl text-(--color-text) text-base sm:text-lg placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/50 focus:border-(--color-accent)/30 transition-all shadow-xl shadow-black/30"
                        />
                        {query && (
                            <button
                                onClick={handleClear}
                                className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-(--color-text-secondary) hover:text-(--color-text) transition-colors"
                                tabIndex={-1}
                                aria-label="Clear search"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {searching && (
                        <div className="absolute left-0 right-0 top-full mt-2 text-center py-2">
                            <span className="text-xs text-(--color-text-secondary)">Searching...</span>
                        </div>
                    )}

                    <div
                        className={`absolute z-50 top-full left-0 right-0 mt-2 bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-150 ease-out origin-top ${
                            showDropdown && !searching
                                ? 'opacity-100 scale-y-100 translate-y-0'
                                : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
                        }`}
                    >
                        {results.length > 0 ? (
                            <ul
                                ref={listRef}
                                id="global-player-listbox"
                                role="listbox"
                                className="py-1.5 max-h-[420px] overflow-y-auto"
                            >
                                {results.map((player, index) => {
                                    const isHighlighted = index === highlightIndex
                                    return (
                                        <li
                                            key={player.id}
                                            id={`gp-option-${index}`}
                                            role="option"
                                            aria-selected={isHighlighted}
                                            onMouseEnter={() => setHighlightIndex(index)}
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                navigateToPlayer(player)
                                            }}
                                            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
                                                isHighlighted ? 'bg-white/10' : 'hover:bg-white/5'
                                            }`}
                                        >
                                            {player.main_role && ROLE_IMAGES[player.main_role] ? (
                                                <img
                                                    src={ROLE_IMAGES[player.main_role]}
                                                    alt={player.main_role}
                                                    className="w-8 h-8 object-contain flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                                    <Users className="w-4 h-4 text-(--color-text-secondary)" />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <div className="text-base font-medium text-(--color-text) truncate">
                                                    <HighlightText text={player.name} query={query} />
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {player.team_color && (
                                                        <span
                                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: player.team_color }}
                                                        />
                                                    )}
                                                    <span className="text-xs text-(--color-text-secondary) truncate">
                                                        {[player.team_name, player.league_name].filter(Boolean).join(' · ') || 'No team'}
                                                    </span>
                                                </div>
                                            </div>

                                            <span className="text-xs text-(--color-text-secondary)/60 flex-shrink-0">
                                                View Profile
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="px-5 py-6 text-sm text-(--color-text-secondary) text-center">
                                No players found for "{query}"
                            </p>
                        )}
                    </div>
                </div>

                {!loading && stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 w-full max-w-3xl pb-8">
                        {statCards.map(({ label, value, icon: Icon }) => (
                            <div key={label} className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-xl px-2 py-2.5 sm:px-3 sm:py-3.5 text-center">
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-1 sm:mb-1.5 text-(--color-text-secondary)" />
                                <div className="text-base sm:text-xl font-bold font-heading">{value}</div>
                                <div className="text-[10px] sm:text-[11px] text-(--color-text-secondary) uppercase tracking-wider mt-0.5">{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
                    </div>
                )}
            </div>
        </div>
    )
}
