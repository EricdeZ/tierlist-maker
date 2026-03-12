import soloImage from '../../../assets/roles/solo.webp'
import jungleImage from '../../../assets/roles/jungle.webp'
import midImage from '../../../assets/roles/mid.webp'
import suppImage from '../../../assets/roles/supp.webp'
import adcImage from '../../../assets/roles/adc.webp'

export const ROLE_IMAGES = { Solo: soloImage, Jungle: jungleImage, Mid: midImage, Support: suppImage, ADC: adcImage }
export const ROLE_LIST = ['Solo', 'Jungle', 'Mid', 'Support', 'ADC']

export const API = import.meta.env.VITE_API_URL || '/api'
export const STORAGE_KEY = 'smite2_admin_pending'

// ─── Persistence helpers ───
export function loadStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
    catch { return [] }
}

export function saveStorage(items) {
    // Strip non-serializable fields (File objects, blob URLs)
    const clean = items.map(mr => ({
        ...mr,
        images: mr.images?.map(img => ({ id: img.id, name: img.name })) || [],
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
}

let _uid = Date.now()
export const uid = () => `mr_${_uid++}`

// ─── Discord queue helpers ───
export function groupDiscordItems(items) {
    const sorted = [...items].sort((a, b) => new Date(a.message_timestamp) - new Date(b.message_timestamp))
    const groups = []
    let cur = null

    for (const item of sorted) {
        const ts = new Date(item.message_timestamp).getTime()
        const sameAuthor = cur?.author_id === item.author_id
        const withinWindow = cur && (ts - cur.lastTs < 10 * 60 * 1000)

        if (sameAuthor && withinWindow) {
            cur.items.push(item)
            cur.lastTs = ts
            if (item.message_content) cur.texts.add(item.message_content)
        } else {
            cur = {
                id: `grp_${item.id}`,
                author_id: item.author_id,
                author_name: item.author_name,
                division_name: item.division_name,
                league_name: item.league_name,
                channel_name: item.channel_name,
                firstTs: ts,
                lastTs: ts,
                texts: new Set(item.message_content ? [item.message_content] : []),
                items: [item],
            }
            groups.push(cur)
        }
    }

    return groups.reverse()
}

export function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const mins = Math.round(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
}

// ─── Build editable data from AI extraction result ───
export function buildEditData(result, adminData) {
    const pm0 = result.player_matches?.[0]
    const meta = result.match_meta

    // Build lookup: league_player_id → last role_played
    const lastRoleLookup = {}
    for (const lr of (adminData?.lastRoles || [])) {
        lastRoleLookup[lr.league_player_id] = lr.role_played
    }
    // Also fall back to league_players.role from roster
    const rosterRoleLookup = {}
    for (const p of (adminData?.players || [])) {
        rosterRoleLookup[p.league_player_id] = p.role
    }

    const games = (result.games || []).map((game, idx) => {
        if (!game.success) return null
        const pm = result.player_matches?.[idx]
        const gw = result.game_winners?.games?.[idx]

        const mapPlayers = (players, side) => players.map(p => {
            const m = pm?.matched?.find(x => x.extracted_name === p.player_name && x.side === side)
            const sub = pm?.unmatched?.find(x => x.extracted_name === p.player_name && x.side === side)
            const lpId = m?.db_player?.league_player_id
            // Prefill role: last recorded role_played > roster role
            const prefillRole = lpId ? (lastRoleLookup[lpId] || rosterRoleLookup[lpId] || null) : null
            // Normalize roster roles like "sub" or "fill" to null (not valid game roles)
            const validRoles = ['Solo', 'Jungle', 'Mid', 'Support', 'ADC']
            const normalizedRole = prefillRole && validRoles.some(r => r.toLowerCase() === prefillRole.toLowerCase())
                ? validRoles.find(r => r.toLowerCase() === prefillRole.toLowerCase())
                : null
            // Resolve display name: matched DB name > known sub name > OCR name
            const resolvedName = m?.db_player?.name || sub?.player_name || null
            return {
                ...p,
                player_name: resolvedName || p.player_name,
                original_name: p.player_name,
                matched_name: resolvedName,
                matched_lp_id: m?.db_player?.league_player_id || null,
                match_source: m?.match_source || (m?.confidence === 'fuzzy' ? 'fuzzy' : null),
                matched_alias: m?.matched_alias || null,
                is_sub: !!sub,
                sub_type: sub?.sub_type || null,
                role_played: normalizedRole,
            }
        })

        const left_players = mapPlayers(game.data.left_players, 'left')
        const right_players = mapPlayers(game.data.right_players, 'right')

        // Ensure exactly one of each role per team — dedup then fill empty slots
        const deduplicateRoles = (teamPlayers) => {
            const seen = new Set()
            for (let i = 0; i < teamPlayers.length; i++) {
                const r = teamPlayers[i].role_played
                if (r) {
                    if (seen.has(r)) {
                        teamPlayers[i].role_played = null
                    } else {
                        seen.add(r)
                    }
                }
            }
            // Fill all empty slots with remaining roles
            const missing = ROLE_LIST.filter(r => !seen.has(r))
            let mi = 0
            for (let i = 0; i < teamPlayers.length; i++) {
                if (!teamPlayers[i].role_played && mi < missing.length) {
                    teamPlayers[i].role_played = missing[mi++]
                }
            }
        }
        deduplicateRoles(left_players)
        deduplicateRoles(right_players)

        return {
            game_index: idx,
            winning_team_id: gw?.winning_team_id || null,
            is_forfeit: false,
            left_players,
            right_players,
        }
    }).filter(Boolean)

    return {
        season_id: pm0?.inferred?.season_id || null,
        team1_id: pm0?.inferred?.left_team_id || null,
        team2_id: pm0?.inferred?.right_team_id || null,
        team1_name: pm0?.inferred?.left_team_name || null,
        team2_name: pm0?.inferred?.right_team_name || null,
        week: null,
        date: new Date().toISOString().split('T')[0],
        best_of: 3,
        games,
    }
}

// ─── Compress & convert image to base64 ───
// Resizes to max 1400px wide (plenty for scoreboard OCR) and uses JPEG 0.85
// Keeps request payload small for serverless function limits
export const compressImage = (file, maxWidth = 1400, quality = 0.85) => new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width))
            width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl.split(',')[1])
    }
    img.onerror = reject
    img.src = url
})
