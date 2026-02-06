// src/hooks/usePlayerStats.js
import { useState, useEffect } from 'react'
import { useDivision } from '../context/DivisionContext'
import { statsService } from '../services/database'

/**
 * Fetches and processes player stats for the current division's active season.
 * Must be used within a DivisionProvider (inside a division route).
 */
export const usePlayerStats = () => {
    const { season } = useDivision()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!season) return

        let cancelled = false

        const fetchStats = async () => {
            setLoading(true)
            setError(null)

            try {
                const playerStats = await statsService.getPlayerStats(season.id)
                if (cancelled) return

                const processed = playerStats.map(player => {
                    const gamesPlayed = parseInt(player.games_played) || 0
                    const wins = parseInt(player.wins) || 0
                    const totalKills = parseInt(player.total_kills) || 0
                    const totalDeaths = parseInt(player.total_deaths) || 0
                    const totalAssists = parseInt(player.total_assists) || 0
                    const totalDamage = parseInt(player.total_damage) || 0
                    const totalMitigated = parseInt(player.total_mitigated) || 0

                    const kda = totalDeaths === 0
                        ? totalKills + (totalAssists / 2)
                        : (totalKills + (totalAssists / 2)) / totalDeaths

                    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0

                    return {
                        id: player.id,
                        name: player.name,
                        tracker: player.tracker_url || '',
                        role: player.role || '',
                        secondary_role: player.secondary_role || '',
                        team: {
                            name: player.team_name || 'No Team',
                            color: player.team_color || '#6b7280',
                        },
                        stats: {
                            kills: totalKills,
                            deaths: totalDeaths,
                            assists: totalAssists,
                            damage: totalDamage,
                            mitigated: totalMitigated,
                            gamesPlayed,
                        },
                        avgStats: {
                            avgKills: parseFloat(player.avg_kills) || 0,
                            avgDeaths: parseFloat(player.avg_deaths) || 0,
                            avgAssists: parseFloat(player.avg_assists) || 0,
                            avgDamage: parseFloat(player.avg_damage) || 0,
                            avgMitigated: parseFloat(player.avg_mitigated) || 0,
                        },
                        kda,
                        winRate,
                    }
                })

                setData(processed)
            } catch (err) {
                if (!cancelled) {
                    console.error('Error loading player stats:', err)
                    setError(err.message)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchStats()
        return () => { cancelled = true }
    }, [season])

    return { data, loading, error, season }
}