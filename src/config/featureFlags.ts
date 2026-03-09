// src/config/featureFlags.ts

/**
 * Feature flags configuration
 * Set these to true/false to enable/disable features
 */
export const FEATURE_FLAGS: Record<string, boolean> = {
    FORGE_RELEASED: true,         // Fantasy Forge publicly visible
    BYOT_RELEASED: true,                  // Bring Your Own Team self-service team creation
    CARD_CLASH_RELEASED: false,            // Card Clash mini-game (admin-only while in dev)
}

/**
 * Helper function to check if a feature is enabled
 */
export const isFeatureEnabled = (flagName: string): boolean => {
    return FEATURE_FLAGS[flagName] === true
}
