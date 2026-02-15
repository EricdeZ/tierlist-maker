// src/pages/division/Stats.jsx
import PlayerList from '../../components/PlayerList'
import { useDivision } from '../../context/DivisionContext'
import PageTitle from '../../components/PageTitle'

const Stats = () => {
    const { division } = useDivision()

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {division && <PageTitle title={`Stats - ${division.name}`} description={`Player statistics for the ${division.name} division. KDA, damage, mitigated, win rates, and per-game performance analytics.`} />}
            <PlayerList />
        </div>
    )
}

export default Stats
