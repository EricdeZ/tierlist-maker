// Shared R2 image upload utilities
// Used by team-upload.js, codex-upload.js, and any future image endpoints

import { adminHeaders } from './db.js'

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_SIZE = 2 * 1024 * 1024 // 2MB (client compresses before upload)
export const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
export const ALL_EXTS = Object.values(EXT_MAP)

// Allowed key prefixes for the r2-image serving endpoint
export const ALLOWED_PREFIXES = ['team-icons/', 'codex/', 'community-teams/', 'vault-assets/']

// ─── Validation ───

export function validateMagicBytes(bytes, mimeType) {
    if (bytes.length < 4) return false
    if (mimeType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    if (mimeType === 'image/jpeg') return bytes[0] === 0xFF && bytes[1] === 0xD8
    if (mimeType === 'image/gif') return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    if (mimeType === 'image/webp') return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    return false
}

/**
 * Validate a File from FormData. Returns { bytes, ext } or throws with { status, message }.
 */
export async function validateImageFile(file) {
    if (!file || typeof file === 'string') {
        throw Object.assign(new Error('file required'), { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw Object.assign(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), { status: 415 })
    }
    if (file.size > MAX_SIZE) {
        throw Object.assign(new Error('Image must be under 2MB'), { status: 413 })
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!validateMagicBytes(bytes, file.type)) {
        throw Object.assign(new Error('File content does not match declared type'), { status: 415 })
    }
    return { bytes, ext: EXT_MAP[file.type] }
}

// ─── R2 Operations ───

/**
 * Upload bytes to R2 and return the API-served URL.
 */
export async function uploadToR2(bucket, key, bytes, contentType) {
    await bucket.put(key, bytes, { httpMetadata: { contentType } })
    return buildImageUrl(key)
}

/**
 * Remove old extensions for the same ID (e.g. replacing a .png with a .webp).
 */
export async function cleanOldExtensions(bucket, prefix, id, currentExt) {
    for (const ext of ALL_EXTS) {
        if (ext !== currentExt) {
            await bucket.delete(`${prefix}${id}.${ext}`)
        }
    }
}

/**
 * Delete an R2 object by its stored URL (handles both API-path and legacy CDN formats).
 */
export function extractR2Key(url) {
    if (!url) return null
    if (url.includes('key=')) {
        return decodeURIComponent(new URL(url, 'http://x').searchParams.get('key'))
    }
    try {
        const urlPath = new URL(url).pathname
        return urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
    } catch {
        return null
    }
}

export async function deleteR2Object(bucket, url) {
    const key = extractR2Key(url)
    if (key) await bucket.delete(key)
    return key
}

// ─── URL Building ───

/**
 * Build the API-served URL for an R2 key. Works locally (Vite proxy) and in production.
 */
export function buildImageUrl(key) {
    return `/api/r2-image?key=${encodeURIComponent(key)}&v=${Date.now()}`
}

// ─── Request Helpers (for multipart upload endpoints that bypass adapt()) ───

export function buildUploadEvent(request) {
    const url = new URL(request.url)
    const headers = {}
    for (const [key, value] of request.headers) {
        headers[key.toLowerCase()] = value
    }
    const queryStringParameters = {}
    for (const [key, value] of url.searchParams) {
        queryStringParameters[key] = value
    }
    return {
        event: { httpMethod: request.method, headers, queryStringParameters, body: null, path: url.pathname, rawUrl: request.url },
        url,
    }
}

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: adminHeaders })
}

export function populateEnv(env) {
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') process.env[key] = value
    }
}
