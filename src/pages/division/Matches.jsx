// src/pages/division/Matches.jsx
import { useDivision } from '../../context/DivisionContext'

const Matches = () => {
    const { season } = useDivision()

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-2 text-center">
                Schedule & Results
            </h1>
            <p className="text-(--color-text-secondary) text-center mb-8">{season?.name}</p>
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center">
                <p className="text-(--color-text-secondary) text-lg">🏗️ Match schedule coming soon</p>
                <p className="text-(--color-text-secondary)/60 text-sm mt-2">
                    Weekly matchups, results, and game details will appear here.
                </p>
            </div>
        </div>
    )
}

export default Matches