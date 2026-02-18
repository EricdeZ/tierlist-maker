// src/pages/Rankings.jsx
import { useState } from 'react'
import DragDropRankings from '../components/DragDropRankings'
import PublishTierListModal from '../components/PublishTierListModal'
import { useAuth } from '../context/AuthContext'
import { useDivision } from '../context/DivisionContext'
import { tierlistFeedService } from '../services/database'

const Rankings = () => {
    const { user, login, loading } = useAuth()
    const { season, league, division, teams: rawTeams, players: rawPlayers } = useDivision()
    const [publishRankings, setPublishRankings] = useState(null)

    // Build teams with player arrays for the modal
    const teams = rawTeams?.map(team => ({
        ...team,
        players: rawPlayers?.filter(p => p.team_id === team.id).map(p => p.name) || [],
    })) || []

    const handlePublish = async (rankings, title) => {
        if (!season?.id) throw new Error('No active season')
        await tierlistFeedService.publish(season.id, rankings, title)
    }

    const handlePublishClick = (rankings) => {
        if (!user) {
            login()
            return
        }
        setPublishRankings(rankings)
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <DragDropRankings onPublish={handlePublishClick} />

            {publishRankings && (
                <PublishTierListModal
                    rankings={publishRankings}
                    teams={teams}
                    league={league}
                    division={division}
                    season={season}
                    onPublish={handlePublish}
                    onClose={() => setPublishRankings(null)}
                />
            )}
        </div>
    )
}

export default Rankings
