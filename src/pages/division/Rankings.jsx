// src/pages/division/Rankings.jsx
import DragDropRankings from '../../components/DragDropRankings'
import { useDivision } from '../../context/DivisionContext'
import PageTitle from '../../components/PageTitle'

const Rankings = () => {
    const { division } = useDivision()

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {division && <PageTitle title={`Rankings - ${division.name}`} />}
            <DragDropRankings />
        </div>
    )
}

export default Rankings
