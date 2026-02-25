import { execSync } from 'child_process'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

export async function mergeAudioVideo(audioFiles, videoPath, outputPath, steps) {
    const dir = resolve(videoPath, '..')
    const concatListPath = resolve(dir, 'concat.txt')
    const fullAudioPath = resolve(dir, 'full-audio.mp3')

    const entries = []

    for (let i = 0; i < audioFiles.length; i++) {
        const audio = audioFiles[i]
        const step = steps[i]
        const pauseAfter = step.pauseAfter || 0

        if (audio.filePath) {
            entries.push(`file '${audio.filePath.replace(/\\/g, '/')}'`)
        }

        // Add silence for pauseAfter or for non-narrated steps
        const silenceMs = audio.filePath ? pauseAfter : (step.duration || 1000)
        if (silenceMs > 0) {
            const silencePath = resolve(dir, `silence_${i}.mp3`)
            const silenceSec = (silenceMs / 1000).toFixed(3)
            execSync(
                `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${silenceSec} -q:a 9 "${silencePath}"`,
                { stdio: 'pipe' }
            )
            entries.push(`file '${silencePath.replace(/\\/g, '/')}'`)
        }
    }

    writeFileSync(concatListPath, entries.join('\n'), 'utf-8')

    // Concatenate all audio clips
    console.log('  [MERGE] Concatenating audio...')
    execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:a libmp3lame -q:a 2 "${fullAudioPath}"`,
        { stdio: 'pipe' }
    )

    // Mux video + audio into final mp4
    console.log('  [MERGE] Muxing video + audio...')
    execSync(
        `ffmpeg -y -i "${videoPath}" -i "${fullAudioPath}" ` +
        `-c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k ` +
        `-shortest -movflags +faststart "${outputPath}"`,
        { stdio: 'pipe' }
    )
}
