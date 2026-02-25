import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { execSync } from 'child_process'

const TTS_MODEL = 'tts-1-hd'
const TTS_VOICE = 'nova'
const TTS_SPEED = 1.15

export async function generateAllAudio(steps, tmpDir) {
    const results = []

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        if (!step.narrate) {
            results.push({ filePath: null, duration: 0 })
            continue
        }

        const filePath = resolve(tmpDir, `audio_${i}.mp3`)
        console.log(`  [TTS] Step ${i}: "${step.narrate.slice(0, 50)}..."`)

        try {
            await generateAudio(step.narrate, filePath)
            const duration = getAudioDuration(filePath)
            results.push({ filePath, duration })
            console.log(`         → ${(duration / 1000).toFixed(1)}s`)
        } catch (err) {
            console.warn(`  [TTS] Step ${i} failed: ${err.message} — using 3s silence`)
            const silencePath = resolve(tmpDir, `silence_fallback_${i}.mp3`)
            execSync(
                `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 -q:a 9 "${silencePath}"`,
                { stdio: 'pipe' }
            )
            results.push({ filePath: silencePath, duration: 3000 })
        }
    }

    return results
}

async function generateAudio(text, outputPath) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: TTS_MODEL,
            input: text,
            voice: TTS_VOICE,
            speed: TTS_SPEED,
            response_format: 'mp3',
        }),
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`TTS API ${response.status}: ${err}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(outputPath, buffer)
}

export function getAudioDuration(filePath) {
    const result = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8' }
    )
    return Math.ceil(parseFloat(result.trim()) * 1000)
}
