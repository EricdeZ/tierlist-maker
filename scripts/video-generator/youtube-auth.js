#!/usr/bin/env node

/**
 * One-time YouTube OAuth setup.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use existing)
 *   3. Enable "YouTube Data API v3"
 *   4. Create OAuth 2.0 credentials (type: Web application)
 *      - Add redirect URI: http://localhost:3847/oauth2callback
 *
 * Usage:
 *   node scripts/video-generator/youtube-auth.js
 */

import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { google } from 'googleapis'
import { loadDevVars } from './auth.js'
import readline from 'readline'

const DEV_VARS_PATH = resolve(process.cwd(), '.dev.vars')
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(res => rl.question(question, ans => { rl.close(); res(ans.trim()) }))
}

function appendToDevVars(key, value) {
    const content = existsSync(DEV_VARS_PATH) ? readFileSync(DEV_VARS_PATH, 'utf-8') : ''
    const lines = content.split('\n')
    const idx = lines.findIndex(l => l.startsWith(`${key}=`))
    if (idx >= 0) {
        lines[idx] = `${key}=${value}`
    } else {
        lines.push(`${key}=${value}`)
    }
    writeFileSync(DEV_VARS_PATH, lines.join('\n'))
}

async function run() {
    loadDevVars()

    let clientId = process.env.YOUTUBE_CLIENT_ID
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET

    if (!clientId) {
        clientId = await prompt('YouTube OAuth Client ID: ')
        appendToDevVars('YOUTUBE_CLIENT_ID', clientId)
    }
    if (!clientSecret) {
        clientSecret = await prompt('YouTube OAuth Client Secret: ')
        appendToDevVars('YOUTUBE_CLIENT_SECRET', clientSecret)
    }

    // Use redirect_uri = http://localhost (no path) for maximum compatibility
    const REDIRECT_URI = 'http://localhost:3847'
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

    const authUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    })

    console.log('\nOpen this URL in your browser:\n')
    console.log(authUrl)
    console.log()

    // Start local server to catch the redirect
    const code = await new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, REDIRECT_URI)
            const code = url.searchParams.get('code')
            const error = url.searchParams.get('error')
            if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end('<h2>Authorization denied.</h2><p>You can close this tab.</p>')
                server.close()
                reject(new Error(`OAuth error: ${error}`))
                return
            }
            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end('<h2>Authorization successful!</h2><p>You can close this tab.</p>')
                server.close()
                resolve(code)
                return
            }
            res.writeHead(404)
            res.end()
        })
        server.listen(3847, () => {
            console.log('Waiting for authorization (listening on port 3847)...')
        })
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error('Port 3847 is in use. Kill the process using it and try again.'))
            } else {
                reject(err)
            }
        })
    })

    // Exchange code for tokens
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
        console.error('\nNo refresh token received. Try revoking access at https://myaccount.google.com/permissions and re-running.')
        process.exit(1)
    }

    appendToDevVars('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token)
    console.log('\nYouTube credentials saved to .dev.vars')
    console.log('You can now use --upload with the video generator.')
}

run().catch(err => {
    console.error(`\n✗ ${err.message}`)
    process.exit(1)
})
