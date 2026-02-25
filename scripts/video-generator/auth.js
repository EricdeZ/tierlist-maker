import { SignJWT } from 'jose'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let devVarsLoaded = false

export function loadDevVars() {
    if (devVarsLoaded) return
    devVarsLoaded = true

    const devVarsPath = resolve(process.cwd(), '.dev.vars')
    let content
    try {
        content = readFileSync(devVarsPath, 'utf-8')
    } catch {
        return // .dev.vars doesn't exist, rely on environment variables
    }

    for (const line of content.split('\n')) {
        if (!line.includes('=') || line.startsWith('#')) continue
        const idx = line.indexOf('=')
        const key = line.slice(0, idx).trim()
        const val = line.slice(idx + 1).trim()
        if (!process.env[key]) process.env[key] = val
    }
}

export async function generateToken(options = {}) {
    const { userId = 1, discordId = 'video-generator', role = 'admin' } = options

    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not found — add it to .dev.vars or set as env var')

    const secretKey = new TextEncoder().encode(secret)

    return await new SignJWT({ userId, discordId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(secretKey)
}
