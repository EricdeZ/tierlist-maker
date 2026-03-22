import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function sketchSaver() {
  return {
    name: 'sketch-saver',
    configureServer(server) {
      server.middlewares.use('/api/sketch', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return }
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const buf = Buffer.concat(chunks)
        // Parse multipart boundary
        const contentType = req.headers['content-type'] || ''
        const boundaryMatch = contentType.match(/boundary=(.+)/)
        if (!boundaryMatch) { res.statusCode = 400; res.end('{"error":"no boundary"}'); return }
        const boundary = '--' + boundaryMatch[1]
        const str = buf.toString('latin1')
        const start = str.indexOf('\r\n\r\n') + 4
        const end = str.lastIndexOf(boundary) - 2
        const pngBuf = Buffer.from(str.slice(start, end), 'latin1')
        const dir = path.resolve('sketches')
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const filename = `sketch-${Date.now()}.png`
        fs.writeFileSync(path.join(dir, filename), pngBuf)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, filename }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
    tailwindcss(),
    sketchSaver(),
  ],
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:8788'
    }
  }
})
