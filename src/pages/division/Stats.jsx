// src/pages/division/Stats.jsx
import PlayerList from '../../components/PlayerList'
import { useDivision } from '../../context/DivisionContext'
import PageTitle from '../../components/PageTitle'

const Stats = () => {
    const { division } = useDivision()

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {division && <PageTitle title={`Stats - ${division.name}`} />}
            <PlayerList />
        </div>
    )
}

export default Stats
