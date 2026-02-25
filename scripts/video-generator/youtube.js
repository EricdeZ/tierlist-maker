import { google } from 'googleapis'
import { createReadStream, statSync } from 'fs'
import { basename } from 'path'

function getAuth() {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            'YouTube credentials not configured.\n' +
            'Run: node scripts/video-generator/youtube-auth.js'
        )
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
}

/**
 * Upload a video to YouTube.
 *
 * @param {string} filePath - Path to the MP4 file
 * @param {object} options
 * @param {string} options.title - Video title
 * @param {string} [options.description] - Video description
 * @param {string[]} [options.tags] - Video tags
 * @param {string} [options.privacy] - 'private' | 'unlisted' | 'public' (default: 'private')
 * @param {string} [options.categoryId] - YouTube category ID (default: '20' = Gaming)
 * @returns {Promise<{id: string, url: string}>}
 */
export async function uploadToYouTube(filePath, options = {}) {
    const auth = getAuth()
    const youtube = google.youtube({ version: 'v3', auth })

    const {
        title = basename(filePath, '.mp4'),
        description = '',
        tags = [],
        privacy = 'private',
        categoryId = '20',
    } = options

    const fileSize = statSync(filePath).size
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1)
    console.log(`  Uploading ${fileSizeMB} MB...`)

    const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
            snippet: {
                title,
                description,
                tags,
                categoryId,
            },
            status: {
                privacyStatus: privacy,
            },
        },
        media: {
            body: createReadStream(filePath),
        },
    })

    const videoId = res.data.id
    const url = `https://youtu.be/${videoId}`

    console.log(`  Uploaded: ${url} (${privacy})`)
    return { id: videoId, url }
}
