// src/components/DatabaseTest.jsx
import { useEffect, useState } from 'react'
import { healthCheck, leagueService, seasonService, teamService } from '../services/database'

const DatabaseTest = () => {
    const [status, setStatus] = useState({ loading: true })

    useEffect(() => {
        const testConnection = async () => {
            const stepResults = []

            try {
                console.log('=== Starting Database Connection Test ===')

                // Step 1: Test basic fetch to functions
                stepResults.push('Step 1: Testing Netlify Functions availability...')
                try {
                    const response = await fetch('/.netlify/functions/leagues')
                    stepResults.push(`  - Functions response status: ${response.status}`)

                    if (!response.ok) {
                        const errorText = await response.text()
                        stepResults.push(`  - Functions error body: ${errorText}`)
                        throw new Error(`Functions not available: ${response.status} ${response.statusText}`)
                    }
                } catch (fetchError) {
                    stepResults.push(`  - Fetch error: ${fetchError.message}`)
                    throw new Error(`Functions endpoint not accessible: ${fetchError.message}`)
                }

                // Step 2: Test health check
                stepResults.push('Step 2: Testing health check...')
                const health = await healthCheck()
                stepResults.push(`  - Health check result: ${JSON.stringify(health)}`)

                if (!health.connected) {
                    throw new Error(`Health check failed: ${health.error}`)
                }

                // Step 3: Test leagues endpoint
                stepResults.push('Step 3: Testing leagues endpoint...')
                let leagues = []
                try {
                    leagues = await leagueService.getAll()
                    stepResults.push(`  - Found ${leagues.length} league(s)`)
                } catch (leagueError) {
                    stepResults.push(`  - Leagues error: ${leagueError.message}`)
                    throw new Error(`Failed to fetch leagues: ${leagueError.message}`)
                }

                // Step 4: Find Test League
                stepResults.push('Step 4: Looking for Test League...')
                const testLeague = leagues.find(l => l.slug === 'test-league')

                if (!testLeague) {
                    stepResults.push('  - Available leagues:')
                    leagues.forEach(l => stepResults.push(`    * ${l.name} (${l.slug})`))
                    throw new Error('Test League not found in database')
                }
                stepResults.push(`  - Test League found: ${testLeague.name} (ID: ${testLeague.id})`)

                // Step 5: Get full league with divisions and seasons
                stepResults.push('Step 5: Loading league details with divisions/seasons...')
                const leagueDetails = await leagueService.getBySlug('test-league')
                stepResults.push(`  - Divisions found: ${leagueDetails.divisions?.length || 0}`)

                if (leagueDetails.divisions) {
                    leagueDetails.divisions.forEach(d => {
                        stepResults.push(`    * ${d.name}: ${d.seasons?.length || 0} season(s)`)
                    })
                }

                // Step 6: Get active season
                stepResults.push('Step 6: Finding active season...')
                const activeSeason = await seasonService.getActiveSeason('test-league')
                stepResults.push(`  - Active season: ${activeSeason.name} (ID: ${activeSeason.id})`)
                stepResults.push(`  - Division: ${activeSeason.division_name}`)

                // Step 7: Test teams endpoint
                stepResults.push('Step 7: Testing teams endpoint...')
                let teams = []
                try {
                    teams = await teamService.getAllBySeason(activeSeason.id)
                    stepResults.push(`  - Teams found: ${teams.length}`)
                } catch (teamError) {
                    stepResults.push(`  - Teams error: ${teamError.message}`)
                    throw new Error(`Failed to fetch teams: ${teamError.message}`)
                }

                // Success!
                stepResults.push('✅ All tests passed!')
                setStatus({
                    connected: true,
                    leagues: leagues.length,
                    teams: teams.length,
                    leagueName: testLeague.name,
                    leagueId: testLeague.id,
                    seasonName: activeSeason.name,
                    seasonId: activeSeason.id,
                    divisionName: activeSeason.division_name,
                    stepResults,
                    details: {
                        allLeagues: leagues.map(l => ({ id: l.id, name: l.name, slug: l.slug })),
                        divisions: leagueDetails.divisions,
                        teamNames: teams.map(t => t.name),
                        currentUrl: window.location.origin,
                        functionsBaseUrl: `${window.location.origin}/.netlify/functions`
                    }
                })

            } catch (error) {
                console.error('Database test error:', error)
                stepResults.push(`❌ Error: ${error.message}`)

                setStatus({
                    connected: false,
                    error: error.message,
                    stepResults,
                    details: {
                        stack: error.stack,
                        currentUrl: window.location.origin,
                        functionsBaseUrl: `${window.location.origin}/.netlify/functions`,
                        timestamp: new Date().toISOString()
                    }
                })
            }
        }

        testConnection()
    }, [])

    if (status.loading) return (
        <div className="p-4 bg-blue-100 rounded mb-4">
            <h3 className="font-bold text-blue-800">Testing Database Connection...</h3>
            <p className="text-blue-600">Checking Netlify Functions API...</p>
        </div>
    )

    if (!status.connected) return (
        <div className="p-4 bg-red-100 rounded mb-4">
            <h3 className="font-bold text-red-800">Database Connection Failed</h3>
            <p className="text-red-600 mb-2">Error: {status.error}</p>

            <details className="mb-3">
                <summary className="text-sm font-medium text-red-800 cursor-pointer">
                    Step-by-Step Debug Info
                </summary>
                <div className="mt-2 bg-red-50 p-2 rounded">
                    {status.stepResults?.map((step, index) => (
                        <div key={index} className="text-xs text-red-700 font-mono mb-1">
                            {step}
                        </div>
                    ))}
                </div>
            </details>

            <details className="text-sm text-red-500">
                <summary>Technical Details</summary>
                <div className="mt-2 bg-red-50 p-2 rounded">
                    <p><strong>Current URL:</strong> {status.details?.currentUrl}</p>
                    <p><strong>Functions URL:</strong> {status.details?.functionsBaseUrl}</p>
                    <p><strong>Timestamp:</strong> {status.details?.timestamp}</p>
                    <pre className="mt-2 text-xs overflow-auto max-h-32">
                        {status.details?.stack}
                    </pre>
                </div>
            </details>

            <div className="mt-3 text-sm text-red-700">
                <p><strong>Troubleshooting Steps:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                    <li>Check if functions deployed: Visit {status.details?.functionsBaseUrl}/leagues directly</li>
                    <li>Verify DATABASE_URL in Netlify environment variables</li>
                    <li>Check Netlify Functions logs for errors</li>
                    <li>Ensure fresh_start_schema.sql and mock_test_league.sql were run</li>
                </ul>
            </div>
        </div>
    )

    return (
        <div className="p-4 bg-green-100 rounded mb-4">
            <h3 className="font-bold text-green-800">Database Connected Successfully!</h3>
            <div className="text-green-700 mt-2">
                <p><strong>League:</strong> {status.leagueName} (ID: {status.leagueId})</p>
                <p><strong>Season:</strong> {status.seasonName} (ID: {status.seasonId})</p>
                <p><strong>Division:</strong> {status.divisionName}</p>
                <p><strong>Found:</strong> {status.leagues} leagues, {status.teams} teams</p>
                <p><strong>API Base:</strong> {status.details?.functionsBaseUrl}</p>
            </div>

            <details className="mt-3">
                <summary className="text-sm font-medium text-green-800 cursor-pointer">
                    View Execution Steps
                </summary>
                <div className="mt-2 bg-green-50 p-2 rounded">
                    {status.stepResults?.map((step, index) => (
                        <div key={index} className="text-xs text-green-700 font-mono mb-1">
                            {step}
                        </div>
                    ))}
                </div>
            </details>

            <details className="mt-2">
                <summary className="text-sm font-medium text-green-800 cursor-pointer">
                    View League Structure
                </summary>
                <div className="mt-2 text-sm">
                    <div className="mb-2">
                        <strong>Divisions & Seasons:</strong>
                        <ul className="ml-4">
                            {status.details?.divisions?.map(division => (
                                <li key={division.id} className="text-green-700">
                                    <strong>{division.name}</strong>
                                    <ul className="ml-4">
                                        {division.seasons?.map(season => (
                                            <li key={season.id}>
                                                {season.name} {season.is_active ? '(active)' : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <strong>Teams in {status.seasonName}:</strong>
                        <ul className="ml-4">
                            {status.details?.teamNames?.map(teamName => (
                                <li key={teamName} className="text-green-700">{teamName}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </details>
        </div>
    )
}

export default DatabaseTest