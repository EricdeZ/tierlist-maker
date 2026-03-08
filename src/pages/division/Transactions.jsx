import { useState, useEffect, useCallback } from 'react'
import { leagueService, transactionService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'
import Navbar from '../../components/layout/Navbar'
import { ArrowRight, UserPlus, UserMinus, ArrowLeftRight } from 'lucide-react'

const typeConfig = {
    transfer: { label: 'Transfer', icon: ArrowLeftRight, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    pickup:   { label: 'Pickup',   icon: UserPlus,       color: 'text-green-400', bg: 'bg-green-500/15' },
    drop:     { label: 'Released', icon: UserMinus,      color: 'text-red-400', bg: 'bg-red-500/15' },
}

const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const TeamBadge = ({ name, color, slug, logoUrl, leagueSlug, divisionSlug }) => {
    if (!name) return null
    const href = leagueSlug && divisionSlug && slug
        ? `/${leagueSlug}/${divisionSlug}/teams/${slug}`
        : null
    const inner = (
        <>
            <TeamLogo slug={slug} name={name} size={20} logoUrl={logoUrl} color={color} />
            <span className="text-sm font-semibold group-hover:underline" style={{ color: color || 'var(--color-text)' }}>
                {name}
            </span>
        </>
    )
    if (href) return <a href={href} className="inline-flex items-center gap-1.5 group">{inner}</a>
    return <span className="inline-flex items-center gap-1.5">{inner}</span>
}

const Transactions = () => {
    const [leagues, setLeagues] = useState([])
    const [selectedLeagueId, setSelectedLeagueId] = useState('')
    const [divisions, setDivisions] = useState([])
    const [selectedDivisionId, setSelectedDivisionId] = useState('')
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingTx, setLoadingTx] = useState(true)

    // Load all leagues, then fetch detail for each to find active divisions
    useEffect(() => {
        const load = async () => {
            try {
                const allLeagues = await leagueService.getAll()
                // Fetch detail for each league to get divisions + seasons
                const details = await Promise.all(
                    allLeagues.map(l => leagueService.getBySlug(l.slug).catch(() => null))
                )
                // Only keep leagues that have at least one division with an active season
                const active = details.filter(d => d && d.divisions?.some(
                    div => div.seasons?.some(s => s.is_active)
                ))
                setLeagues(active)
            } catch {
                setLeagues([])
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // When league changes, build division list (only divisions with active seasons)
    useEffect(() => {
        if (!selectedLeagueId) {
            setDivisions([])
            setSelectedDivisionId('')
            return
        }
        const league = leagues.find(l => l.id === parseInt(selectedLeagueId))
        if (!league) {
            setDivisions([])
            setSelectedDivisionId('')
            return
        }
        const activeDivs = (league.divisions || []).filter(
            d => d.seasons?.some(s => s.is_active)
        )
        setDivisions(activeDivs)
        setSelectedDivisionId('')
    }, [selectedLeagueId, leagues])

    // Fetch transactions based on filters
    const fetchTransactions = useCallback(async () => {
        setLoadingTx(true)
        try {
            let data
            if (selectedDivisionId) {
                data = await transactionService.getByDivision(selectedDivisionId)
            } else if (selectedLeagueId) {
                data = await transactionService.getByLeague(selectedLeagueId)
            } else {
                data = await transactionService.getRecent()
            }
            setTransactions(data)
        } catch {
            setTransactions([])
        } finally {
            setLoadingTx(false)
        }
    }, [selectedLeagueId, selectedDivisionId])

    useEffect(() => { fetchTransactions() }, [fetchTransactions])

    // Group by date
    const grouped = transactions.reduce((acc, tx) => {
        const date = formatDate(tx.created_at)
        if (!acc[date]) acc[date] = []
        acc[date].push(tx)
        return acc
    }, {})

    if (loading) {
        return (
            <div className="min-h-screen bg-(--color-primary)">
                <Navbar title="Transactions" />
                <div className="flex items-center justify-center p-16 pt-24">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Transactions" />
            <PageTitle title="Transactions" description="Roster transactions and player moves across all leagues." />

            <div className="max-w-3xl mx-auto px-4 pt-24 pb-8">
                <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-2 text-center">
                    Transactions
                </h1>
                <p className="text-(--color-text-secondary) text-center mb-6">
                    Roster moves and player transactions
                </p>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-8 justify-center">
                    <select
                        value={selectedLeagueId}
                        onChange={(e) => setSelectedLeagueId(e.target.value)}
                        className="bg-(--color-secondary) border border-white/15 rounded-lg px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent) cursor-pointer"
                    >
                        <option value="">All Leagues</option>
                        {leagues.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedDivisionId}
                        onChange={(e) => setSelectedDivisionId(e.target.value)}
                        disabled={!selectedLeagueId}
                        className="bg-(--color-secondary) border border-white/15 rounded-lg px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent) cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <option value="">All Divisions</option>
                        {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                {/* Transaction list */}
                {loadingTx ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-12 text-center">
                        <p className="text-(--color-text-secondary) text-lg">No recent roster moves.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([date, txs]) => (
                            <div key={date}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">
                                        {date}
                                    </div>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>
                                <div className="space-y-2">
                                    {txs.map(tx => {
                                        const config = typeConfig[tx.type] || typeConfig.transfer
                                        const Icon = config.icon

                                        return (
                                            <div
                                                key={tx.id}
                                                className="bg-(--color-secondary) rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3 hover:border-white/20 transition-colors"
                                            >
                                                <div className={`${config.bg} rounded-lg p-2 flex-shrink-0`}>
                                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                                        <span className={`text-xs font-bold uppercase tracking-wide ${config.color}`}>
                                                            {config.label}
                                                        </span>
                                                        <span className="text-sm font-bold text-(--color-text)">
                                                            {tx.player_name}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1">
                                                        {tx.from_team_name && (
                                                            <TeamBadge
                                                                name={tx.from_team_name}
                                                                color={tx.from_team_color}
                                                                slug={tx.from_team_slug}
                                                                logoUrl={tx.from_team_logo}
                                                                leagueSlug={tx.league_slug}
                                                                divisionSlug={tx.division_slug}
                                                            />
                                                        )}
                                                        {tx.from_team_name && tx.to_team_name && (
                                                            <ArrowRight className="w-3.5 h-3.5 text-(--color-text-secondary) flex-shrink-0" />
                                                        )}
                                                        {tx.to_team_name && (
                                                            <TeamBadge
                                                                name={tx.to_team_name}
                                                                color={tx.to_team_color}
                                                                slug={tx.to_team_slug}
                                                                logoUrl={tx.to_team_logo}
                                                                leagueSlug={tx.league_slug}
                                                                divisionSlug={tx.division_slug}
                                                            />
                                                        )}
                                                    </div>

                                                    {!selectedLeagueId && tx.league_name && (
                                                        <div className="text-xs text-(--color-text-secondary)/60 mt-1">
                                                            {tx.league_name} — {tx.division_name}
                                                        </div>
                                                    )}
                                                    {selectedLeagueId && !selectedDivisionId && tx.division_name && (
                                                        <div className="text-xs text-(--color-text-secondary)/60 mt-1">
                                                            {tx.division_name}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-xs text-(--color-text-secondary) flex-shrink-0 text-right">
                                                    {formatTime(tx.created_at)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Transactions
