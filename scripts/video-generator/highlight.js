export async function injectHighlight(page, selector) {
    await page.evaluate((sel) => {
        document.getElementById('__video-highlight')?.remove()

        const target = document.querySelector(sel)
        if (!target) return

        const rect = target.getBoundingClientRect()

        if (!document.getElementById('__highlight-styles')) {
            const style = document.createElement('style')
            style.id = '__highlight-styles'
            style.textContent = `
                @keyframes __highlight-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(255,170,51,0.6), 0 0 40px rgba(255,170,51,0.3); }
                    50% { box-shadow: 0 0 30px rgba(255,170,51,0.8), 0 0 60px rgba(255,170,51,0.5); }
                }
            `
            document.head.appendChild(style)
        }

        const overlay = document.createElement('div')
        overlay.id = '__video-highlight'
        overlay.style.cssText = `
            position: fixed;
            top: ${rect.top - 8}px;
            left: ${rect.left - 8}px;
            width: ${rect.width + 16}px;
            height: ${rect.height + 16}px;
            border: 3px solid #ffaa33;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(255,170,51,0.6), 0 0 40px rgba(255,170,51,0.3);
            pointer-events: none;
            z-index: 99999;
            animation: __highlight-pulse 1s ease-in-out infinite;
        `
        document.body.appendChild(overlay)
    }, selector)

    await page.waitForTimeout(800)
}

export async function removeHighlight(page) {
    await page.evaluate(() => {
        document.getElementById('__video-highlight')?.remove()
    })
}
