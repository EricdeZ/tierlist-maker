// Vault signature upload — depicted player submits their drawn signature as a PNG
// Uses raw onRequest (not adapt) for multipart form handling, same as vault-dashboard-upload.js
import { getDB } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { validateImageFile, uploadToR2, buildUploadEvent, json, populateEnv } from '../lib/r2.js'

export async function onRequest(context) {
    const { request, env } = context
    populateEnv(env)

    if (request.method === 'OPTIONS') return json({}, 204)
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const { event } = buildUploadEvent(request)
    const user = await requireAuth(event)
    if (!user) return json({ error: 'Login required' }, 401)

    const sql = getDB()
    const bucket = env.TEAM_ICONS

    let formData
    try {
        formData = await request.formData()
    } catch {
        return json({ error: 'Invalid multipart form data' }, 400)
    }

    const file = formData.get('file')
    const requestId = parseInt(formData.get('requestId'))
    const directCardId = parseInt(formData.get('cardId'))

    if (!requestId && !directCardId) return json({ error: 'requestId or cardId required' }, 400)

    let bytes, ext
    try {
        ({ bytes, ext } = await validateImageFile(file))
    } catch (e) {
        return json({ error: e.message }, e.status || 400)
    }

    // --- Direct sign: owner is the depicted player, skip request/approval ---
    if (directCardId) {
        const [card] = await sql`
            SELECT c.id, c.owner_id, c.rarity, c.signature_url, c.card_data,
                   COALESCE(c.depicted_user_id, bp.depicted_user_id) AS depicted_user_id,
                   d.player_id
            FROM cc_cards c
            LEFT JOIN cc_player_defs d ON c.def_id = d.id
            LEFT JOIN cc_card_blueprints bp ON c.blueprint_id = bp.id
            WHERE c.id = ${directCardId}
        `
        if (!card) return json({ error: 'Card not found' }, 404)
        if (card.owner_id !== user.id) return json({ error: 'Not your card' }, 403)
        if (card.rarity !== 'unique') return json({ error: 'Only unique cards' }, 400)
        if (card.signature_url) return json({ error: 'Already signed' }, 400)

        // Path 1: depicted_user_id matches current user
        const isDepictedUser = card.depicted_user_id && card.depicted_user_id === user.id

        // Path 2: legacy — linked_player_id matches card's player def
        const playerId = card.player_id || card.card_data?._testPlayerId
        const isLinkedPlayer = user.linked_player_id && playerId && playerId === user.linked_player_id

        if (!isDepictedUser && !isLinkedPlayer) {
            return json({ error: 'You must be the depicted player to direct-sign' }, 403)
        }

        const key = `vault-assets/signatures/${directCardId}.${ext}`
        const signatureUrl = await uploadToR2(bucket, key, bytes, file.type)
        await sql`UPDATE cc_cards SET signature_url = ${signatureUrl} WHERE id = ${directCardId}`

        return json({ success: true, signatureUrl })
    }

    // --- Request-based sign: standard flow ---
    const [req] = await sql`
        SELECT sr.id, sr.card_id, sr.signer_player_id, sr.status, c.signature_url,
               COALESCE(c.depicted_user_id, bp.depicted_user_id) AS depicted_user_id
        FROM cc_signature_requests sr
        JOIN cc_cards c ON sr.card_id = c.id
        LEFT JOIN cc_card_blueprints bp ON c.blueprint_id = bp.id
        WHERE sr.id = ${requestId}
    `
    if (!req) return json({ error: 'Request not found' }, 404)
    // Check depicted_user_id as alternative auth
    const isDepictedUser = req.depicted_user_id && req.depicted_user_id === user.id
    const isLinkedSigner = user.linked_player_id && req.signer_player_id === user.linked_player_id

    if (!isDepictedUser && !isLinkedSigner) {
        return json({ error: 'Not your request to sign' }, 403)
    }
    if (req.status !== 'pending') return json({ error: 'Request is not pending' }, 400)
    if (req.signature_url) return json({ error: 'Card is already signed' }, 400)

    const key = `vault-assets/signatures/${req.card_id}.${ext}`
    const signatureUrl = await uploadToR2(bucket, key, bytes, file.type)

    await sql`UPDATE cc_signature_requests SET status = 'awaiting_approval', pending_signature_url = ${signatureUrl}, signed_at = NOW() WHERE id = ${requestId}`

    return json({ success: true, signatureUrl })
}
