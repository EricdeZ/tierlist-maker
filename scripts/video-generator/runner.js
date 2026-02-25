#!/usr/bin/env node

import { resolve, basename } from 'path'
import { mkdir, rm, readdir, readFile } from 'fs/promises'
import { chromium } from 'playwright'
import { generateAllAudio } from './tts.js'
import { generateToken, loadDevVars } from './auth.js'
import { injectHighlight, removeHighlight } from './highlight.js'
import { mergeAudioVideo } from './merge.js'
import { preflight } from './preflight.js'
import { uploadToYouTube } from './youtube.js'

const BASE_URL = 'http://localhost:5173'

// Pre-compute What's New content hash so we can seed localStorage and prevent the modal
async function computeWhatsNewHash() {
    const md = await readFile(resolve(process.cwd(), 'src/data/patch-notes.md'), 'utf-8')
    let hash = 5381
    for (let i = 0; i < md.length; i++) {
        hash = ((hash << 5) + hash + md.charCodeAt(i)) | 0
    }
    return hash.toString(36)
}

async function dismissOverlays(page) {
    // Forge Tutorial — click "Skip tutorial" if visible
    try {
        const skip = page.getByRole('button', { name: 'Skip tutorial' })
        if (await skip.isVisible({ timeout: 2000 })) {
            await skip.click()
            console.log('  [OVERLAY] Dismissed Forge Tutorial')
            await page.waitForTimeout(500)
        }
    } catch { /* not present */ }

    // What's New — fallback in case hash pre-seed didn't prevent it
    try {
        const btn = page.getByRole('button', { name: 'Got it' })
        if (await btn.isVisible({ timeout: 500 })) {
            await btn.click()
            console.log('  [OVERLAY] Dismissed What\'s New modal')
            await page.waitForTimeout(500)
        }
    } catch { /* not present */ }
}

async function performAction(page, step) {
    switch (step.action) {
        case 'navigate':
            await page.goto(step.url, { waitUntil: 'networkidle', timeout: 15000 })
            await page.waitForTimeout(800)
            await dismissOverlays(page)
            break
        case 'click':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.click(step.selector, step.force ? { force: true } : undefined)
            break
        case 'type':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.fill(step.selector, step.value)
            break
        case 'select':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.evaluate(({ sel, text, idx }) => {
                const elements = document.querySelectorAll(sel)
                const select = elements[idx || 0]
                if (!select) return
                const option = [...select.options].find(o => o.textContent.includes(text))
                if (option) {
                    select.value = option.value
                    select.dispatchEvent(new Event('change', { bubbles: true }))
                }
            }, { sel: step.selector, text: step.value, idx: step.selectorIndex || 0 })
            break
        case 'scroll':
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), step.scrollY || 0)
            await page.waitForTimeout(500) // let smooth scroll finish
            break
        case 'hover':
            await page.waitForSelector(step.selector, { timeout: 10000 })
            await page.hover(step.selector)
            break
        case 'drag':
            const src = page.locator(step.selector).first()
            const tgt = page.locator(step.target).first()
            await src.waitFor({ timeout: 10000 })
            await tgt.waitFor({ timeout: 10000 })
            // Use manual mouse events for HTML5 drag compatibility
            const srcBox = await src.boundingBox()
            const tgtBox = await tgt.boundingBox()
            if (srcBox && tgtBox) {
                await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2)
                await page.mouse.down()
                await page.waitForTimeout(100)
                await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, { steps: 15 })
                await page.waitForTimeout(100)
                await page.mouse.up()
            }
            break
        case 'wait':
            await page.waitForTimeout(step.duration || 1000)
            break
        case 'waitFor':
            await page.waitForSelector(step.selector, {
                state: step.state || 'visible',
                timeout: step.timeout || 30000,
            })
            break
        case 'highlight':
            break // highlight-only step, handled by the highlight logic in run()
        default:
            console.warn(`  [WARN] Unknown action: ${step.action}`)
    }
}

async function run(scriptPath, { upload = false } = {}) {
    loadDevVars()
    preflight({ upload })

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

        // 3. Launch browser
        console.log('[3/5] Launching browser...')
        const browser = await chromium.launch({ headless: true })

        // Seed auth token + localStorage in a temporary (non-recording) context
        const baseUrl = script.baseUrl || BASE_URL
        const whatsNewHash = await computeWhatsNewHash()
        const seedContext = await browser.newContext()
        const seedPage = await seedContext.newPage()
        await seedPage.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 })
        await seedPage.evaluate(({ token, hash }) => {
            localStorage.setItem('auth_token', token)
            localStorage.setItem('whats-new-hash', hash)
        }, { token, hash: whatsNewHash })
        const storageState = await seedContext.storageState()
        await seedContext.close()

        // Create recording context with pre-seeded state (no preamble in video)
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            recordVideo: {
                dir: videoDir,
                size: { width: 1920, height: 1080 },
            },
            storageState,
        })
        const page = await context.newPage()

        // 4. Execute steps
        console.log('[4/5] Recording steps...')
        const stepTimings = []
        for (let i = 0; i < script.steps.length; i++) {
            const step = script.steps[i]
            const audio = audioFiles[i]
            const waitMs = audio.duration + (step.pauseAfter || 0)
            const stepStart = Date.now()

            console.log(`  Step ${i + 1}/${script.steps.length}: ${step.action}${step.selector ? ` → ${step.selector.slice(0, 40)}` : ''}`)

            // Perform action first (navigate, click, etc.)
            try {
                await performAction(page, step)
            } catch (err) {
                console.warn(`  [WARN] Step ${i + 1} action failed: ${err.message}`)
                try {
                    await page.screenshot({ path: resolve(tmpDir, `debug_step_${i}.png`) })
                } catch { /* ignore screenshot failures */ }
            }

            // Highlight AFTER action completes so element is on screen during narration
            if (step.highlight && step.selector) {
                try {
                    await injectHighlight(page, step.selector)
                } catch {
                    // element may not exist, that's ok
                }
            }

            // Wait for audio duration (minus time already spent on the action)
            const actionElapsed = Date.now() - stepStart
            const remainingWait = Math.max(0, waitMs - actionElapsed)
            if (remainingWait > 0) {
                await page.waitForTimeout(remainingWait)
            }

            // Remove highlight after narration finishes
            if (step.highlight && step.selector) {
                try {
                    await removeHighlight(page)
                } catch { /* ignore */ }
            }

            stepTimings.push(Date.now() - stepStart)
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
        await mergeAudioVideo(audioFiles, videoPath, outputPath, script.steps, stepTimings)

        console.log(`\n✓ Output: ${outputPath}`)

        // 6. Upload to YouTube (optional)
        if (upload) {
            console.log('[6] Uploading to YouTube...')
            const yt = script.youtube || {}
            const result = await uploadToYouTube(outputPath, {
                title: yt.title || script.title,
                description: yt.description || '',
                tags: yt.tags || [],
                privacy: yt.privacy || 'private',
            })
            console.log(`\n✓ YouTube: ${result.url}\n`)
            return { outputPath, youtube: result }
        }

        console.log()
        return { outputPath }
    } finally {
        // Clean up temp files
        try {
            await rm(tmpDir, { recursive: true, force: true })
        } catch { /* ignore cleanup errors */ }
    }
}

// CLI entry point
const args = process.argv.slice(2)
const upload = args.includes('--upload')
const scriptArg = args.find(a => !a.startsWith('--'))

if (!scriptArg) {
    console.error('Usage: node scripts/video-generator/runner.js <script-path> [--upload]')
    console.error('Example: node scripts/video-generator/runner.js scripts/video-generator/scripts/forge-intro.js')
    console.error('  --upload   Upload the finished video to YouTube')
    process.exit(1)
}

run(scriptArg, { upload }).catch(err => {
    console.error(`\n✗ ${err.message}`)
    process.exit(1)
})
