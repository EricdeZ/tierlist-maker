#!/usr/bin/env node

import { resolve, basename } from 'path'
import { mkdir, rm, readdir } from 'fs/promises'
import { chromium } from 'playwright'
import { generateAllAudio } from './tts.js'
import { generateToken, loadDevVars } from './auth.js'
import { injectHighlight, removeHighlight } from './highlight.js'
import { mergeAudioVideo } from './merge.js'
import { preflight } from './preflight.js'

const BASE_URL = 'http://localhost:5173'

async function performAction(page, step) {
    switch (step.action) {
        case 'navigate':
            await page.goto(step.url, { waitUntil: 'networkidle', timeout: 15000 })
            break
        case 'click':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.click(step.selector)
            break
        case 'type':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.fill(step.selector, step.value)
            break
        case 'scroll':
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), step.scrollY || 0)
            await page.waitForTimeout(500) // let smooth scroll finish
            break
        case 'hover':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.hover(step.selector)
            break
        case 'wait':
            await page.waitForTimeout(step.duration || 1000)
            break
        case 'highlight':
            break // highlight-only step, handled by the highlight logic in run()
        default:
            console.warn(`  [WARN] Unknown action: ${step.action}`)
    }
}

async function run(scriptPath) {
    loadDevVars()
    preflight()

    // Load script
    const absPath = resolve(process.cwd(), scriptPath)
    const mod = await import(`file://${absPath.replace(/\\/g, '/')}`)
    const script = mod.default
    if (!script?.steps?.length) throw new Error('Script must export { title, steps[] }')

    console.log(`\n▸ ${script.title}`)
    console.log(`  ${script.steps.length} steps\n`)

    // Temp directory
    const timestamp = Date.now()
    const tmpDir = resolve(process.cwd(), 'scripts/video-generator/.tmp', String(timestamp))
    const videoDir = resolve(tmpDir, 'video')
    await mkdir(videoDir, { recursive: true })

    // Output directory
    const outputDir = resolve(process.cwd(), 'scripts/video-generator/output')
    await mkdir(outputDir, { recursive: true })

    try {
        // 1. Generate TTS audio
        console.log('[1/5] Generating voiceover...')
        const audioFiles = await generateAllAudio(script.steps, tmpDir)

        // 2. Generate auth token
        console.log('[2/5] Generating auth token...')
        const token = await generateToken(script.auth)

        // 3. Launch browser with recording
        console.log('[3/5] Launching browser...')
        const browser = await chromium.launch({ headless: true })
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            recordVideo: {
                dir: videoDir,
                size: { width: 1920, height: 1080 },
            },
        })
        const page = await context.newPage()

        // Seed auth token
        const baseUrl = script.baseUrl || BASE_URL
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 })
        await page.evaluate((t) => localStorage.setItem('auth_token', t), token)
        await page.reload({ waitUntil: 'networkidle', timeout: 15000 })

        // Small settle pause
        await page.waitForTimeout(1000)

        // 4. Execute steps
        console.log('[4/5] Recording steps...')
        for (let i = 0; i < script.steps.length; i++) {
            const step = script.steps[i]
            const audio = audioFiles[i]
            const waitMs = audio.duration + (step.pauseAfter || 0)

            console.log(`  Step ${i + 1}/${script.steps.length}: ${step.action}${step.selector ? ` → ${step.selector.slice(0, 40)}` : ''}`)

            // Highlight
            if (step.highlight && step.selector) {
                try {
                    await injectHighlight(page, step.selector)
                } catch {
                    // element may not exist yet, that's ok
                }
            }

            // Perform action
            const actionStart = Date.now()
            try {
                await performAction(page, step)
            } catch (err) {
                console.warn(`  [WARN] Step ${i + 1} action failed: ${err.message}`)
                // Take debug screenshot
                try {
                    await page.screenshot({ path: resolve(tmpDir, `debug_step_${i}.png`) })
                } catch { /* ignore screenshot failures */ }
            }

            // Remove highlight
            if (step.highlight && step.selector) {
                try {
                    await removeHighlight(page)
                } catch { /* ignore */ }
            }

            // Wait for audio duration (minus time already spent on the action)
            const actionElapsed = Date.now() - actionStart
            const remainingWait = Math.max(0, waitMs - actionElapsed)
            if (remainingWait > 0) {
                await page.waitForTimeout(remainingWait)
            }
        }

        // Stop recording
        await page.close()
        await context.close()
        await browser.close()

        // Find the recorded video file
        const videoFiles = await readdir(videoDir)
        const webmFile = videoFiles.find(f => f.endsWith('.webm'))
        if (!webmFile) throw new Error('No video recording found')
        const videoPath = resolve(videoDir, webmFile)

        // 5. Merge audio + video
        console.log('[5/5] Merging audio + video...')
        const safeName = script.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
        const outputPath = resolve(outputDir, `${safeName}.mp4`)
        await mergeAudioVideo(audioFiles, videoPath, outputPath, script.steps)

        console.log(`\n✓ Output: ${outputPath}\n`)
        return outputPath
    } finally {
        // Clean up temp files
        try {
            await rm(tmpDir, { recursive: true, force: true })
        } catch { /* ignore cleanup errors */ }
    }
}

// CLI entry point
const scriptArg = process.argv[2]
if (!scriptArg) {
    console.error('Usage: node scripts/video-generator/runner.js <script-path>')
    console.error('Example: node scripts/video-generator/runner.js scripts/video-generator/scripts/forge-intro.js')
    process.exit(1)
}

run(scriptArg).catch(err => {
    console.error(`\n✗ ${err.message}`)
    process.exit(1)
})
