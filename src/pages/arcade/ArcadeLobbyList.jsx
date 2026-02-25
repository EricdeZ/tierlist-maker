import ArcadeLobbyCard from './ArcadeLobbyCard'

export default function ArcadeLobbyList({ lobbies, loading, onSelect, emptyMessage }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="arcade-label arcade-pulse" style={{ color: 'var(--arcade-cyan)' }}>
                    LOADING...
                </div>
            </div>
        )
    }

    if (!lobbies || lobbies.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="arcade-label mb-2" style={{ color: 'var(--arcade-text-mid)' }}>
                    {emptyMessage || 'NO ACTIVE CABINETS'}
                </p>
                <p className="text-sm" style={{ color: 'var(--arcade-text-dim)' }}>
                    Create a new game to get started
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 arcade-stagger">
            {lobbies.map(lobby => (
                <ArcadeLobbyCard
                    key={lobby.id}
                    lobby={lobby}
                    onSelect={() => onSelect(lobby.id)}
                />
            ))}
        </div>
    )
}
