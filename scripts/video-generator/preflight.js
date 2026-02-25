import { execSync } from 'child_process'

export function preflight({ upload = false } = {}) {
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' })
    } catch {
        throw new Error(
            'ffmpeg not found on PATH.\n' +
            'Install: winget install Gyan.FFmpeg  or  https://ffmpeg.org/download.html'
        )
    }

    try {
        execSync('ffprobe -version', { stdio: 'pipe' })
    } catch {
        throw new Error('ffprobe not found on PATH (usually bundled with ffmpeg)')
    }

    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set — add to .dev.vars or set as env var')
    }

    if (upload) {
        const missing = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN']
            .filter(k => !process.env[k])
        if (missing.length) {
            throw new Error(
                `YouTube credentials missing: ${missing.join(', ')}\n` +
                'Run: node scripts/video-generator/youtube-auth.js'
            )
        }
    }
}
