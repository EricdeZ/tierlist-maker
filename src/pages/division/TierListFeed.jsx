import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { tierlistFeedService } from '../../services/database'
import TierListPostCard from '../../components/TierListPostCard'
import { MessageSquare, Plus } from 'lucide-react'

const TierListFeed = () => {
    const { leagueSlug, divisionSlug } = useParams()
    const { season, league, division, teams: rawTeams, players: rawPlayers } = useDivision()
    const { user } = useAuth()

    const [posts, setPosts] = useState([])
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState(null)

    // Build teams with player arrays for the post card color lookup
    const teams = rawTeams?.map(team => ({
        ...team,
        players: rawPlayers?.filter(p => p.team_id === team.id).map(p => p.name) || [],
    })) || []

    const fetchFeed = useCallback(async (offset = 0) => {
        if (!season?.id) return
        try {
            const data = await tierlistFeedService.getFeed(season.id, 20, offset)
            if (offset === 0) {
                setPosts(data.posts)
            } else {
                setPosts(prev => [...prev, ...data.posts])
            }
            setTotal(data.total)
            setHasMore(data.hasMore)
        } catch (err) {
            setError(err.message)
        }
    }, [season?.id])

    useEffect(() => {
        setLoading(true)
        fetchFeed(0).finally(() => setLoading(false))
    }, [fetchFeed])

    const loadMore = async () => {
        setLoadingMore(true)
        await fetchFeed(posts.length)
        setLoadingMore(false)
    }

    const handleLike = async (postId) => {
        const data = await tierlistFeedService.like(postId)
        setPosts(prev => prev.map(p =>
            p.id === postId
                ? { ...p, likeCount: data.likeCount, likedByMe: data.liked }
                : p
        ))
    }

    const handleDelete = async (postId) => {
        if (!confirm('Delete this post?')) return
        await tierlistFeedService.deletePost(postId)
        setPosts(prev => prev.filter(p => p.id !== postId))
        setTotal(prev => prev - 1)
    }

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--color-accent)" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-(--color-text) font-heading">Tier List Feed</h1>
                    {total > 0 && (
                        <span className="text-xs text-(--color-text-secondary)">
                            {total} post{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <Link
                    to={`/${leagueSlug}/${divisionSlug}/tierlist/create`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
                >
                    <Plus className="w-4 h-4" />
                    Create My Own
                </Link>
            </div>

            {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            {posts.length === 0 ? (
                <div className="text-center py-16">
                    <MessageSquare className="w-12 h-12 text-(--color-text-secondary)/30 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-(--color-text) mb-2">No posts yet</h3>
                    <p className="text-sm text-(--color-text-secondary)">
                        Be the first to share your tier list!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map(post => (
                        <TierListPostCard
                            key={post.id}
                            post={post}
                            teams={teams}
                            league={league}
                            division={division}
                            season={season}
                            onLike={handleLike}
                            onDelete={handleDelete}
                        />
                    ))}

                    {hasMore && (
                        <div className="text-center pt-2">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-(--color-text) hover:bg-white/15 transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default TierListFeed
