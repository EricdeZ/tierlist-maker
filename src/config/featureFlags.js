// src/config/featureFlags.js

/**
 * Feature flags configuration
 * Set these to true/false to enable/disable features
 */
export const FEATURE_FLAGS = {
    FORGE_RELEASED: true,         // Fantasy Forge publicly visible
    BYOT_RELEASED: true,                  // Bring Your Own Team self-service team creation
    CARD_CLASH_RELEASED: true,             // Card Clash mini-game
    VAULT_OPEN: true,                      // The Vault open to all authenticated users
    VAULT_MAINTENANCE: true,              // The Vault maintenance mode (admins bypass)
}

/**
 * Helper function to check if a feature is enabled
 * @param {string} flagName - The feature flag name
 * @returns {boolean} - Whether the feature is enabled
 */
export const isFeatureEnabled = (flagName) => {
    return FEATURE_FLAGS[flagName] === true
}
