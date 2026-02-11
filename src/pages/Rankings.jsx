// src/pages/Rankings.jsx
import DragDropRankings from '../components/DragDropRankings'
import { useAuth } from '../context/AuthContext'
import { ListOrdered } from 'lucide-react'

const Rankings = () => {
    const { user, login, loading } = useAuth()

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* Save rankings banner */}
            {!loading && !user && (
                <div className="mb-6 rounded-xl border border-(--color-accent)/20 bg-(--color-accent)/5 p-4 flex flex-col sm:flex-row items-center gap-3">
                    {/*<div className="flex items-center gap-3 flex-1 min-w-0">*/}
                    {/*    <ListOrdered className="w-5 h-5 text-(--color-accent) shrink-0" />*/}
                    {/*    <p className="text-sm text-(--color-text-secondary)">*/}
                    {/*        <strong className="text-(--color-text)">Log in with Discord</strong> to save your tier lists and share them with the community.*/}
                    {/*    </p>*/}
                    {/*</div>*/}
                    <button
                        onClick={login}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors shrink-0"
                    >
                        Login with Discord
                    </button>
                </div>
            )}
            <DragDropRankings />
        </div>
    )
}

export default Rankings
