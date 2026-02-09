// src/config/featureFlags.js

/**
 * Feature flags configuration
 * Set these to true/false to enable/disable features
 */
export const FEATURE_FLAGS = {
    ENABLE_EXPORT_IMPORT: true,    // Export/import functionality
}

/**
 * Helper function to check if a feature is enabled
 * @param {string} flagName - The feature flag name
 * @returns {boolean} - Whether the feature is enabled
 */
export const isFeatureEnabled = (flagName) => {
    return FEATURE_FLAGS[flagName] === true
}
