/**
 * DullShopper - Shared Constants
 */

const DULLSHOPPER_CONSTANTS = {
  DEFAULT_SETTINGS: {
    enabled: true,                // Global master switch
    autoDetect: true,             // Automatically detect web shops
    grayscaleIntensity: 100,      // Grayscale percentage (0 - 100)
    dimImages: false,             // Slightly dim brightness for less eye-catching images
    reduceContrast: false,        // Slightly reduce contrast to make items look drab
    includePreloadedShops: true,  // Use curated list of popular web shops
    useCommunityBlocklist: true,  // Use Community Shopping Blocklist
    autoUpdateCommunityList: true,// Automatically update community blocklist
    showBadge: true,              // Show badge indicator on toolbar icon
    showBanner: false             // Show unobtrusive notification banner on dulled pages
  },

  STATUS: {
    DULLED_DETECTED: 'dulled_detected',   // Automatically detected shop
    DULLED_BLOCKED: 'dulled_blocked',     // User manually added to block list
    DULLED_PRELOADED: 'dulled_preloaded', // Known popular shop
    DULLED_COMMUNITY: 'dulled_community', // Community blocklist shop
    WHITELISTED: 'whitelisted',           // User explicitly allowed / disabled dulling
    NORMAL: 'normal'                      // Normal website, color untouched
  },

  MESSAGES: {
    GET_PAGE_STATUS: 'DULLSHOPPER_GET_PAGE_STATUS',
    SHOP_DETECTED: 'DULLSHOPPER_SHOP_DETECTED',
    SET_DOMAIN_STATUS: 'DULLSHOPPER_SET_DOMAIN_STATUS',
    UPDATE_SETTINGS: 'DULLSHOPPER_UPDATE_SETTINGS',
    GET_POPUP_DATA: 'DULLSHOPPER_GET_POPUP_DATA',
    GET_OPTIONS_DATA: 'DULLSHOPPER_GET_OPTIONS_DATA',
    APPLY_STYLES: 'DULLSHOPPER_APPLY_STYLES',
    UPDATE_COMMUNITY_LIST: 'DULLSHOPPER_UPDATE_COMMUNITY_LIST',
    GET_COMMUNITY_STATUS: 'DULLSHOPPER_GET_COMMUNITY_STATUS'
  },

  STORAGE_KEYS: {
    SETTINGS: 'dullshopper_settings',
    BLOCKLIST: 'dullshopper_blocklist',
    WHITELIST: 'dullshopper_whitelist',
    DETECTED_SHOPS: 'dullshopper_detected_shops',
    COMMUNITY_TEXT: 'dullshopper_community_text',
    COMMUNITY_META: 'dullshopper_community_meta'
  },

  LEGACY_STORAGE_KEYS: {
    SETTINGS: 'dullsopper_settings',
    BLOCKLIST: 'dullsopper_blocklist',
    WHITELIST: 'dullsopper_whitelist',
    DETECTED_SHOPS: 'dullsopper_detected_shops',
    COMMUNITY_TEXT: 'dullsopper_community_text',
    COMMUNITY_META: 'dullsopper_community_meta'
  },

  COMMUNITY_LIST_URL: 'https://raw.githubusercontent.com/StbanMc/CommunityBlocklists/main/exports/hosts/shopping.txt',
  COMMUNITY_ALARM_NAME: 'dullshopper_community_update_alarm'
};

// Aliases for backward compatibility
const DULLSOPPER_CONSTANTS = DULLSHOPPER_CONSTANTS;

if (typeof globalThis !== 'undefined') {
  globalThis.DULLSHOPPER_CONSTANTS = DULLSHOPPER_CONSTANTS;
  globalThis.DULLSOPPER_CONSTANTS = DULLSHOPPER_CONSTANTS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DULLSHOPPER_CONSTANTS;
}
