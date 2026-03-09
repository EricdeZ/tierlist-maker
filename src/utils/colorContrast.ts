// src/utils/colorContrast.ts

/**
 * Returns '#000000' or '#ffffff' depending on which has better contrast
 * against the given background color.
 *
 * Uses WCAG relative luminance formula.
 */
export function getContrastColor(hex: string | null | undefined): string {
    if (!hex) return '#ffffff'

    // Strip # and handle shorthand
    let c = hex.replace('#', '')
    if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
    }

    const r = parseInt(c.substring(0, 2), 16) / 255
    const g = parseInt(c.substring(2, 4), 16) / 255
    const b = parseInt(c.substring(4, 6), 16) / 255

    // sRGB -> linear
    const toLinear = (v: number): number => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))

    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

    // Threshold ~0.35 tends to give good results for both light and dark colors
    return luminance > 0.35 ? '#000000' : '#ffffff'
}
