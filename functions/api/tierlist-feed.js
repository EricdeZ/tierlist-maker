import { adapt } from '../lib/adapter.js'
import { getDB, headers, getHeaders } from '../lib/db.js'
import { requireAuth, verifyAuth } from '../lib/auth.js'
import { grantPassion } from '../lib/passion.js'

const POSTS_PER_PAGE = 20
const MAX_POSTS_PER_DAY = 1

const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' }
    }

    const sql = getDB()
    const params = event.queryStringParameters || {}
    const { action } = params

    try {
        if (event.httpMethod === 'GET') {
            switch (action) {
                case 'feed':
                    return await getFeed(sql, event, params)
                case 'post':
                    return await getPost(sql, event, params)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
            }
        }

        // POST requires auth
        const user = await requireAuth(event)
        if (!user) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
        }

        if (event.httpMethod === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {}

            switch (body.action) {
                case 'publish':
                    return await publishPost(sql, user, body)
                case 'like':
                    return await toggleLike(sql, user, body)
                case 'delete':
                    return await deletePost(sql, user, body)
                default:
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) }
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
    } catch (error) {
        console.error('tierlist-feed error:', error)
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
    }
}


// ═══════════════════════════════════════════════════
// GET: Paginated feed for a season
// ═══════════════════════════════════════════════════
async function getFeed(sql, event, params) {
    const { seasonId, limit: limitStr, offset: offsetStr } = params
    if (!seasonId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId is required' }) }
    }

    const limit = Math.min(parseInt(limitStr) || POSTS_PER_PAGE, 50)
    const offset = parseInt(offsetStr) || 0

    // Optional auth for liked_by_me
    const viewer = await verifyAuth(event)

    const likeJoin = viewer
        ? sql`LEFT JOIN tierlist_likes tl ON tl.post_id = tp.id AND tl.user_id = ${viewer.userId}`
        : sql``

    const likeSelect = viewer
        ? sql`, (tl.id IS NOT NULL) as liked_by_me`
        : sql``

    const posts = await sql`
        SELECT
            tp.id, tp.title, tp.rankings, tp.like_count, tp.created_at,
            u.id as user_id, u.discord_username, u.discord_avatar, u.discord_id
            ${likeSelect}
        FROM tierlist_posts tp
        JOIN users u ON tp.user_id = u.id
        ${likeJoin}
        WHERE tp.season_id = ${seasonId}
        ORDER BY tp.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `

    const [{ total }] = await sql`
        SELECT COUNT(*)::integer as total FROM tierlist_posts WHERE season_id = ${seasonId}
    `

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({
            posts: posts.map(formatPost),
            total,
            hasMore: offset + posts.length < total,
        }),
    }
}


// ═══════════════════════════════════════════════════
// GET: Single post detail
// ═══════════════════════════════════════════════════
async function getPost(sql, event, params) {
    const { postId } = params
    if (!postId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'postId is required' }) }
    }

    const viewer = await verifyAuth(event)

    const likeJoin = viewer
        ? sql`LEFT JOIN tierlist_likes tl ON tl.post_id = tp.id AND tl.user_id = ${viewer.userId}`
        : sql``

    const likeSelect = viewer
        ? sql`, (tl.id IS NOT NULL) as liked_by_me`
        : sql``

    const [post] = await sql`
        SELECT
            tp.id, tp.title, tp.rankings, tp.like_count, tp.created_at,
            u.id as user_id, u.discord_username, u.discord_avatar, u.discord_id
            ${likeSelect}
        FROM tierlist_posts tp
        JOIN users u ON tp.user_id = u.id
        ${likeJoin}
        WHERE tp.id = ${postId}
    `

    if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) }
    }

    return {
        statusCode: 200,
        headers: getHeaders(event),
        body: JSON.stringify({ post: formatPost(post) }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Publish a tier list
// ═══════════════════════════════════════════════════
async function publishPost(sql, user, body) {
    const { seasonId, rankings, title } = body

    if (!seasonId || !rankings) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'seasonId and rankings are required' }) }
    }

    // Validate rankings shape
    const validRoles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
    const hasAnyPlayers = validRoles.some(r => Array.isArray(rankings[r]) && rankings[r].length > 0)
    if (!hasAnyPlayers) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Rankings must have at least one player' }) }
    }

    // Validate title length
    if (title && title.length > 100) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title must be 100 characters or less' }) }
    }

    // Rate limit: MAX_POSTS_PER_DAY per user per season per 24h
    const [{ count }] = await sql`
        SELECT COUNT(*)::integer as count
        FROM tierlist_posts
        WHERE user_id = ${user.id}
          AND season_id = ${seasonId}
          AND created_at > NOW() - INTERVAL '24 hours'
    `

    if (count >= MAX_POSTS_PER_DAY) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: `You can only post ${MAX_POSTS_PER_DAY} tier lists per day per division` }) }
    }

    // Clean rankings — only keep valid role keys with string arrays
    const cleanRankings = {}
    for (const role of validRoles) {
        if (Array.isArray(rankings[role])) {
            cleanRankings[role] = rankings[role].filter(p => typeof p === 'string')
        } else {
            cleanRankings[role] = []
        }
    }

    const [post] = await sql`
        INSERT INTO tierlist_posts (user_id, season_id, title, rankings)
        VALUES (${user.id}, ${seasonId}, ${title || null}, ${JSON.stringify(cleanRankings)})
        RETURNING id, created_at
    `

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, postId: post.id, createdAt: post.created_at }),
    }
}


// ═══════════════════════════════════════════════════
// POST: Toggle like on a post
// ═══════════════════════════════════════════════════
async function toggleLike(sql, user, body) {
    const { postId } = body
    if (!postId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'postId is required' }) }
    }

    // Check post exists and get author
    const [post] = await sql`
        SELECT id, user_id FROM tierlist_posts WHERE id = ${postId}
    `
    if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) }
    }

    // Can't like own post
    if (post.user_id === user.id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot like your own post' }) }
    }

    // Check if already liked
    const [existing] = await sql`
        SELECT id FROM tierlist_likes WHERE post_id = ${postId} AND user_id = ${user.id}
    `

    if (existing) {
        // Unlike
        await sql`DELETE FROM tierlist_likes WHERE id = ${existing.id}`
        await sql`UPDATE tierlist_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${postId}`

        const [updated] = await sql`SELECT like_count FROM tierlist_posts WHERE id = ${postId}`
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, liked: false, likeCount: updated.like_count }),
        }
    } else {
        // Like
        await sql`INSERT INTO tierlist_likes (post_id, user_id) VALUES (${postId}, ${user.id})`
        await sql`UPDATE tierlist_posts SET like_count = like_count + 1 WHERE id = ${postId}`

        // Grant 1 Passion to the post creator (fire-and-forget, once per liker per post)
        const refId = `tierlist_like_${postId}_${user.id}`
        sql`SELECT 1 FROM passion_transactions WHERE reference_id = ${refId} LIMIT 1`.then(([already]) => {
            if (!already) {
                return grantPassion(sql, post.user_id, 'tierlist_like', 1,
                    `Tier list post #${postId} liked`, refId)
            }
        }).catch(err => console.error('passion grant error:', err))

        const [updated] = await sql`SELECT like_count FROM tierlist_posts WHERE id = ${postId}`
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, liked: true, likeCount: updated.like_count }),
        }
    }
}


// ═══════════════════════════════════════════════════
// POST: Delete own post
// ═══════════════════════════════════════════════════
async function deletePost(sql, user, body) {
    const { postId } = body
    if (!postId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'postId is required' }) }
    }

    const [post] = await sql`
        SELECT id, user_id FROM tierlist_posts WHERE id = ${postId}
    `
    if (!post) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) }
    }
    if (post.user_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only delete your own posts' }) }
    }

    await sql`DELETE FROM tierlist_posts WHERE id = ${postId}`

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
    }
}


// ═══════════════════════════════════════════════════
// Helper: format post for API response
// ═══════════════════════════════════════════════════
function formatPost(row) {
    return {
        id: row.id,
        title: row.title,
        rankings: row.rankings,
        likeCount: row.like_count,
        createdAt: row.created_at,
        likedByMe: row.liked_by_me || false,
        author: {
            id: row.user_id,
            username: row.discord_username,
            avatar: row.discord_avatar,
            discordId: row.discord_id,
        },
    }
}

export const onRequest = adapt(handler)
