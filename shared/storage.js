/**
 * DullSopper - Storage & Domain Management Utilities
 */

const DullSopperStorage = (() => {
  // Use browser API (Firefox) or chrome API fallback
  const storageArea = (typeof browser !== 'undefined' && browser.storage && browser.storage.local)
    ? browser.storage.local
    : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
      ? chrome.storage.local
      : null;

  const { STORAGE_KEYS, DEFAULT_SETTINGS, STATUS } = (typeof DULLSOPPER_CONSTANTS !== 'undefined')
    ? DULLSOPPER_CONSTANTS
    : {
        STORAGE_KEYS: {
          SETTINGS: 'dullsopper_settings',
          BLOCKLIST: 'dullsopper_blocklist',
          WHITELIST: 'dullsopper_whitelist',
          DETECTED_SHOPS: 'dullsopper_detected_shops'
        },
        DEFAULT_SETTINGS: {
          enabled: true,
          autoDetect: true,
          grayscaleIntensity: 100,
          dimImages: false,
          reduceContrast: false,
          includePreloadedShops: true,
          showBadge: true,
          showBanner: false
        },
        STATUS: {
          DULLED_DETECTED: 'dulled_detected',
          DULLED_BLOCKED: 'dulled_blocked',
          DULLED_PRELOADED: 'dulled_preloaded',
          WHITELISTED: 'whitelisted',
          NORMAL: 'normal'
        }
      };

  /**
   * Safe promise wrapper for storage.get
   */
  async function getFromStorage(key, defaultValue) {
    if (!storageArea) return defaultValue;
    return new Promise((resolve) => {
      try {
        const result = storageArea.get(key, (items) => {
          if (items && items[key] !== undefined) {
            resolve(items[key]);
          } else {
            resolve(defaultValue);
          }
        });
        // Firefox returns Promise for storage operations
        if (result && typeof result.then === 'function') {
          result.then(items => {
            if (items && items[key] !== undefined) {
              resolve(items[key]);
            } else {
              resolve(defaultValue);
            }
          }).catch(() => resolve(defaultValue));
        }
      } catch (err) {
        console.error('DullSopper: storage get error', err);
        resolve(defaultValue);
      }
    });
  }

  /**
   * Safe promise wrapper for storage.set
   */
  async function setToStorage(key, value) {
    if (!storageArea) return;
    return new Promise((resolve) => {
      try {
        const result = storageArea.set({ [key]: value }, () => {
          resolve();
        });
        if (result && typeof result.then === 'function') {
          result.then(() => resolve()).catch(() => resolve());
        }
      } catch (err) {
        console.error('DullSopper: storage set error', err);
        resolve();
      }
    });
  }

  /**
   * Extracts clean domain from URL or domain string.
   * e.g. "https://www.shop.example.com/item" -> "shop.example.com"
   * e.g. "www.example.com" -> "example.com"
   */
  function cleanDomain(input) {
    if (!input || typeof input !== 'string') return '';
    let domain = input.trim().toLowerCase();

    // If starts with scheme, use URL parser
    if (domain.includes('://')) {
      try {
        domain = new URL(domain).hostname;
      } catch {
        domain = domain.split('://')[1].split('/')[0];
      }
    } else {
      // Remove path or query string if present
      domain = domain.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    }

    // Strip leading www.
    domain = domain.replace(/^www\./, '');
    return domain;
  }

  /**
   * Checks if domain matches a list item (exact, subdomain, or wildcard).
   */
  function domainMatches(domain, rule) {
    if (!domain || !rule) return false;
    const d = cleanDomain(domain);
    let r = cleanDomain(rule);

    if (r.startsWith('*.')) {
      r = r.substring(2);
      return d === r || d.endsWith('.' + r);
    }

    return d === r || d.endsWith('.' + r);
  }

  /**
   * Checks if domain is in array of domain rules.
   */
  function isDomainInList(domain, list) {
    if (!Array.isArray(list) || !domain) return false;
    return list.some(rule => domainMatches(domain, rule));
  }

  // --- Settings APIs ---
  async function getSettings() {
    const stored = await getFromStorage(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async function saveSettings(newSettings) {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    await setToStorage(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  // --- Blocklist APIs (User-added domains to always dull) ---
  async function getBlocklist() {
    return await getFromStorage(STORAGE_KEYS.BLOCKLIST, []);
  }

  async function addToBlocklist(domain) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return false;

    const list = await getBlocklist();
    if (!list.includes(cleaned)) {
      list.push(cleaned);
      await setToStorage(STORAGE_KEYS.BLOCKLIST, list);
    }
    // If it was in whitelist, remove it
    await removeFromWhitelist(cleaned);
    return true;
  }

  async function removeFromBlocklist(domain) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return false;

    const list = await getBlocklist();
    const filtered = list.filter(item => cleanDomain(item) !== cleaned);
    await setToStorage(STORAGE_KEYS.BLOCKLIST, filtered);
    return true;
  }

  // --- Whitelist APIs (User-added domains to NEVER dull) ---
  async function getWhitelist() {
    return await getFromStorage(STORAGE_KEYS.WHITELIST, []);
  }

  async function addToWhitelist(domain) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return false;

    const list = await getWhitelist();
    if (!list.includes(cleaned)) {
      list.push(cleaned);
      await setToStorage(STORAGE_KEYS.WHITELIST, list);
    }
    // If it was in blocklist, remove it
    await removeFromBlocklist(cleaned);
    return true;
  }

  async function removeFromWhitelist(domain) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return false;

    const list = await getWhitelist();
    const filtered = list.filter(item => cleanDomain(item) !== cleaned);
    await setToStorage(STORAGE_KEYS.WHITELIST, filtered);
    return true;
  }

  // --- Detected Shops Cache ---
  async function getDetectedShops() {
    return await getFromStorage(STORAGE_KEYS.DETECTED_SHOPS, {});
  }

  async function saveDetectedShop(domain, info) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    const detected = await getDetectedShops();
    detected[cleaned] = {
      domain: cleaned,
      detectedAt: Date.now(),
      reasons: info.reasons || [],
      score: info.score || 0,
      url: info.url || ''
    };
    await setToStorage(STORAGE_KEYS.DETECTED_SHOPS, detected);
  }

  async function removeDetectedShop(domain) {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    const detected = await getDetectedShops();
    delete detected[cleaned];
    await setToStorage(STORAGE_KEYS.DETECTED_SHOPS, detected);
  }

  async function clearDetectedShops() {
    await setToStorage(STORAGE_KEYS.DETECTED_SHOPS, {});
  }

  /**
   * Primary Evaluation Function:
   * Determines whether a given domain/URL should be dulled,
   * what its status is, and what reasons apply.
   */
  async function evaluateSite(urlOrDomain, isDetectedShop = false, detectionReasons = [], context = null) {
    const domain = cleanDomain(urlOrDomain);
    const settings = (context && context.settings) ? context.settings : await getSettings();
    const blocklist = (context && context.blocklist) ? context.blocklist : await getBlocklist();
    const whitelist = (context && context.whitelist) ? context.whitelist : await getWhitelist();
    const detectedShops = (context && context.detectedShops) ? context.detectedShops : await getDetectedShops();

    // 1. If master switch is disabled, never dull
    if (!settings.enabled) {
      return {
        isDulled: false,
        status: STATUS.NORMAL,
        domain,
        reason: 'DullSopper is globally disabled',
        settings
      };
    }

    // 2. Check Whitelist (explicit override: never dull)
    if (isDomainInList(domain, whitelist)) {
      return {
        isDulled: false,
        status: STATUS.WHITELISTED,
        domain,
        reason: 'Site is in Allowed List (Whitelist)',
        settings
      };
    }

    // 3. Check Manual Blocklist (explicit override: always dull)
    if (isDomainInList(domain, blocklist)) {
      return {
        isDulled: true,
        status: STATUS.DULLED_BLOCKED,
        domain,
        reason: 'Site is in custom Dull List (Blocklist)',
        settings
      };
    }

    // 4. Check Preloaded Popular Shops (if option enabled)
    if (settings.includePreloadedShops && typeof isPopularShop === 'function' && isPopularShop(domain)) {
      return {
        isDulled: true,
        status: STATUS.DULLED_PRELOADED,
        domain,
        reason: 'Known popular online retail shop',
        settings
      };
    }

    // 5. Check if currently detected OR previously recorded as detected shop
    const previousDetection = detectedShops[domain];
    if (settings.autoDetect && (isDetectedShop || previousDetection)) {
      const reasons = isDetectedShop
        ? detectionReasons
        : (previousDetection ? previousDetection.reasons : []);
      return {
        isDulled: true,
        status: STATUS.DULLED_DETECTED,
        domain,
        reason: 'Detected web shop',
        reasons,
        settings
      };
    }

    // Default: normal website
    return {
      isDulled: false,
      status: STATUS.NORMAL,
      domain,
      reason: 'Normal website (no shop detected)',
      settings
    };
  }

  return {
    cleanDomain,
    domainMatches,
    isDomainInList,
    getSettings,
    saveSettings,
    getBlocklist,
    addToBlocklist,
    removeFromBlocklist,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    getDetectedShops,
    saveDetectedShop,
    removeDetectedShop,
    clearDetectedShops,
    evaluateSite
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.DullSopperStorage = DullSopperStorage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DullSopperStorage;
}
