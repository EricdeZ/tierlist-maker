import { describe, it, expect } from 'vitest'
import { getContrastColor } from '../colorContrast'

describe('getContrastColor', () => {
    it('returns black for white background', () => {
        expect(getContrastColor('#ffffff')).toBe('#000000')
    })

    it('returns white for black background', () => {
        expect(getContrastColor('#000000')).toBe('#ffffff')
    })

    it('returns black for light gray', () => {
        expect(getContrastColor('#cccccc')).toBe('#000000')
    })

    it('returns white for dark blue', () => {
        expect(getContrastColor('#1a1a2e')).toBe('#ffffff')
    })

    it('returns white for null input', () => {
        expect(getContrastColor(null)).toBe('#ffffff')
    })

    it('returns white for undefined input', () => {
        expect(getContrastColor(undefined)).toBe('#ffffff')
    })

    it('returns white for empty string', () => {
        expect(getContrastColor('')).toBe('#ffffff')
    })

    it('handles shorthand hex (#fff)', () => {
        expect(getContrastColor('#fff')).toBe('#000000')
    })

    it('handles shorthand hex (#000)', () => {
        expect(getContrastColor('#000')).toBe('#ffffff')
    })

    it('handles hex without # prefix', () => {
        expect(getContrastColor('ffffff')).toBe('#000000')
    })

    it('returns white for medium-dark color (#3b82f6 — blue)', () => {
        // Blue-500 is medium; luminance is below 0.35
        expect(getContrastColor('#3b82f6')).toBe('#ffffff')
    })

    it('returns black for yellow (#ffff00)', () => {
        // Yellow is very bright
        expect(getContrastColor('#ffff00')).toBe('#000000')
    })

    it('returns white for dark red (#8b0000)', () => {
        expect(getContrastColor('#8b0000')).toBe('#ffffff')
    })
})
