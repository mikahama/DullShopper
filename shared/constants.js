/**
 * DullSopper - Shared Constants
 */

const DULLSOPPER_CONSTANTS = {
  DEFAULT_SETTINGS: {
    enabled: true,                // Global master switch
    autoDetect: true,             // Automatically detect web shops
    grayscaleIntensity: 100,      // Grayscale percentage (0 - 100)
    dimImages: false,             // Slightly dim brightness for less eye-catching images
    reduceContrast: false,        // Slightly reduce contrast to make items look drab
    includePreloadedShops: true,  // Use curated list of popular web shops
    showBadge: true,              // Show badge indicator on toolbar icon
    showBanner: false             // Show unobtrusive notification banner on dulled pages
  },

  STATUS: {
    DULLED_DETECTED: 'dulled_detected',   // Automatically detected shop
    DULLED_BLOCKED: 'dulled_blocked',     // User manually added to block list
    DULLED_PRELOADED: 'dulled_preloaded', // Known popular shop
    WHITELISTED: 'whitelisted',           // User explicitly allowed / disabled dulling
    NORMAL: 'normal'                      // Normal website, color untouched
  },

  MESSAGES: {
    GET_PAGE_STATUS: 'DULLSOPPER_GET_PAGE_STATUS',
    SHOP_DETECTED: 'DULLSOPPER_SHOP_DETECTED',
    SET_DOMAIN_STATUS: 'DULLSOPPER_SET_DOMAIN_STATUS',
    UPDATE_SETTINGS: 'DULLSOPPER_UPDATE_SETTINGS',
    GET_POPUP_DATA: 'DULLSOPPER_GET_POPUP_DATA',
    GET_OPTIONS_DATA: 'DULLSOPPER_GET_OPTIONS_DATA',
    APPLY_STYLES: 'DULLSOPPER_APPLY_STYLES'
  },

  STORAGE_KEYS: {
    SETTINGS: 'dullsopper_settings',
    BLOCKLIST: 'dullsopper_blocklist',
    WHITELIST: 'dullsopper_whitelist',
    DETECTED_SHOPS: 'dullsopper_detected_shops'
  }
};

// Expose on global/window for both background and content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.DULLSOPPER_CONSTANTS = DULLSOPPER_CONSTANTS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DULLSOPPER_CONSTANTS;
}
