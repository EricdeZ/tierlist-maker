// src/config/featureFlags.js

/**
 * Feature flags configuration
 * Set these to true/false to enable/disable features
 */
export const FEATURE_FLAGS = {
    // Navigation and routing
    SHOW_NAVIGATION: true,        // Show/hide the top navigation bar
    ENABLE_HOME_PAGE: false,       // Enable the separate home page

    // Future features
    ENABLE_TEAM_MANAGEMENT: false, // Team CRUD operations
    ENABLE_EXPORT_IMPORT: true,    // Export/import functionality
    ENABLE_SAVE_RANKINGS: false,   // Save rankings to localStorage/server

    // UI customization
    SHOW_INSTRUCTIONS: false,       // Show the "How to Use" instructions
    COMPACT_MODE: false,          // More compact UI layout
}

/**
 * Helper function to check if a feature is enabled
 * @param {string} flagName - The feature flag name
 * @returns {boolean} - Whether the feature is enabled
 */
export const isFeatureEnabled = (flagName) => {
    return FEATURE_FLAGS[flagName] === true
}

/**
 * Environment-based feature flags
 * Override flags based on environment variables
 */
if (typeof window !== 'undefined') {
    // Check for URL parameters to override flags (useful for testing)
    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.has('show_nav')) {
        FEATURE_FLAGS.SHOW_NAVIGATION = urlParams.get('show_nav') === 'true'
    }

    if (urlParams.has('compact')) {
        FEATURE_FLAGS.COMPACT_MODE = urlParams.get('compact') === 'true'
    }
}