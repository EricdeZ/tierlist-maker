import { describe, it, expect } from 'vitest'
import { FEATURE_FLAGS, isFeatureEnabled } from '../featureFlags'

describe('FEATURE_FLAGS', () => {
    it('contains expected flag keys', () => {
        expect(FEATURE_FLAGS).toHaveProperty('FORGE_RELEASED')
        expect(FEATURE_FLAGS).toHaveProperty('BYOT_RELEASED')
        expect(FEATURE_FLAGS).toHaveProperty('CARD_CLASH_RELEASED')
    })

    it('all flag values are booleans', () => {
        for (const [key, value] of Object.entries(FEATURE_FLAGS)) {
            expect(typeof value).toBe('boolean')
        }
    })
})

describe('isFeatureEnabled', () => {
    it('returns true for an enabled flag', () => {
        // FORGE_RELEASED is currently true
        expect(isFeatureEnabled('FORGE_RELEASED')).toBe(true)
    })

    it('returns false for a disabled flag', () => {
        // CARD_CLASH_RELEASED is currently false
        expect(isFeatureEnabled('CARD_CLASH_RELEASED')).toBe(false)
    })

    it('returns false for a non-existent flag', () => {
        expect(isFeatureEnabled('DOES_NOT_EXIST')).toBe(false)
    })

    it('returns false for undefined value (not just falsy)', () => {
        expect(isFeatureEnabled('')).toBe(false)
    })
})
