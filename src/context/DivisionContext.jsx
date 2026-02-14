// src/context/DivisionContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { leagueService, teamService, playerService } from '../services/database'
import { useAuth } from './AuthContext'

const DivisionContext = createContext(null)

export const DivisionProvider = ({ children }) => {
    const { leagueSlug, divisionSlug } = useParams()
    const { hasAnyPermission } = useAuth()

    const [state, setState] = useState({
        league: null,
        division: null,
        season: null,
        teams: [],
        players: [],
        loading: true,
        error: null,
    })

    useEffect(() => {
        if (!leagueSlug || !divisionSlug) return

        let cancelled = false

        const loadData = async () => {
            setState(prev => ({ ...prev, loading: true, error: null }))

            try {
                // Step 1: Get league with divisions and seasons
                const league = await leagueService.getBySlug(leagueSlug)
                if (cancelled) return

                if (!league) {
                    throw new Error(`League "${leagueSlug}" not found`)
                }

                // Step 2: Find the target division
                const division = league.divisions?.find(d => d.slug === divisionSlug)
                if (!division) {
                    throw new Error(`Division "${divisionSlug}" not found in ${league.name}`)
                }

                // Step 3: Find active season (admins can also see inactive seasons)
                const validSeasons = division.seasons?.filter(s => s.id) || []
                const season = validSeasons.find(s => s.is_active)
                    || (hasAnyPermission && validSeasons[0])

                if (!season) {
                    throw new Error(`No seasons found for division "${division.name}"`)
                }

                // Step 4: Load teams + players for this season in parallel
                const [teams, players] = await Promise.all([
                    teamService.getAllBySeason(season.id),
                    playerService.getAllBySeason(season.id),
                ])
                if (cancelled) return

                setState({
                    league,
                    division,
                    season: {
                        ...season,
                        division_id: division.id,
                        division_name: division.name,
                        division_slug: division.slug,
                    },
                    teams,
                    players,
                    loading: false,
                    error: null,
                })
            } catch (err) {
                if (!cancelled) {
                    console.error('DivisionContext load error:', err)
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        error: err.message,
                    }))
                }
            }
        }

        loadData()
        return () => { cancelled = true }
    }, [leagueSlug, divisionSlug, hasAnyPermission])

    return (
        <DivisionContext.Provider value={state}>
            {children}
        </DivisionContext.Provider>
    )
}

/**
 * Main hook — gives you everything for the current division scope.
 * Must be used inside a route wrapped by DivisionLayout.
 */
export const useDivision = () => {
    const ctx = useContext(DivisionContext)
    if (ctx === null) {
        throw new Error('useDivision must be used within a DivisionProvider (inside a /:leagueSlug/:divisionSlug route)')
    }
    return ctx
}

export default DivisionContext