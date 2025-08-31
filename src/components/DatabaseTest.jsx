// src/components/DatabaseTest.jsx
import { useEffect, useState } from 'react'
import { healthCheck, leagueService, teamService } from '../services/database'

const DatabaseTest = () => {
    const [status, setStatus] = useState({ loading: true })

    useEffect(() => {
        const testConnection = async () => {
            try {
                const health = await healthCheck()
                if (health.connected) {
                    const leagues = await leagueService.getAll()
                    const babylonLeague = leagues.find(l => l.slug === 'babylon-league')
                    let teams = []
                    if (babylonLeague) {
                        teams = await teamService.getAllByLeague(babylonLeague.id)
                    }

                    setStatus({
                        connected: true,
                        leagues: leagues.length,
                        teams: teams.length,
                        leagueName: babylonLeague?.name
                    })
                } else {
                    setStatus({ connected: false, error: health.error })
                }
            } catch (error) {
                setStatus({ connected: false, error: error.message })
            }
        }

        testConnection()
    }, [])

    if (status.loading) return <div className="p-4">Testing database connection...</div>

    if (!status.connected) return (
        <div className="p-4 bg-red-100 rounded">
            <h3 className="font-bold text-red-800">Database Connection Failed</h3>
            <p className="text-red-600">{status.error}</p>
        </div>
    )

    return (
        <div className="p-4 bg-green-100 rounded mb-4">
            <h3 className="font-bold text-green-800">Database Connected!</h3>
            <p>Found {status.leagues} leagues and {status.teams} teams</p>
            <p>League: {status.leagueName}</p>
        </div>
    )
}

export default DatabaseTest