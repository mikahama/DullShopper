/**
 * DullSopper - Community Shopping Blocklist Engine
 * Fetches, parses, caches, and automatically updates the Community Shopping Blocklist:
 * https://raw.githubusercontent.com/StbanMc/CommunityBlocklists/main/exports/hosts/shopping.txt
 */

const DullSopperCommunityList = (() => {
  const browserApi = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  const LIST_URL = (typeof DULLSOPPER_CONSTANTS !== 'undefined' && DULLSOPPER_CONSTANTS.COMMUNITY_LIST_URL)
    ? DULLSOPPER_CONSTANTS.COMMUNITY_LIST_URL
    : 'https://raw.githubusercontent.com/StbanMc/CommunityBlocklists/main/exports/hosts/shopping.txt';

  const STORAGE_KEY_TEXT = (typeof DULLSOPPER_CONSTANTS !== 'undefined')
    ? DULLSOPPER_CONSTANTS.STORAGE_KEYS.COMMUNITY_TEXT
    : 'dullsopper_community_text';

  const STORAGE_KEY_META = (typeof DULLSOPPER_CONSTANTS !== 'undefined')
    ? DULLSOPPER_CONSTANTS.STORAGE_KEYS.COMMUNITY_META
    : 'dullsopper_community_meta';

  let inMemoryDomainSet = null;
  let metadata = {
    domainCount: 0,
    lastUpdated: null,
    lastStatus: 'uninitialized',
    lastError: null,
    sourceUrl: LIST_URL
  };

  let initPromise = null;

  /**
   * Parse hosts-format text into a clean list of domains.
   * Format: "0.0.0.0 domain.com" or "127.0.0.1 domain.com"
   */
  function parseHosts(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const lines = rawText.split('\n');
    const domainList = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(/\s+/);
      let domain = '';
      if (parts.length >= 2) {
        domain = parts[1].toLowerCase().trim().replace(/^www\./, '');
      } else if (parts.length === 1 && parts[0].includes('.')) {
        domain = parts[0].toLowerCase().trim().replace(/^www\./, '');
      }

      if (domain && !seen.has(domain)) {
        seen.add(domain);
        domainList.push(domain);
      }
    }
    return domainList;
  }

  /**
   * Load metadata from browser storage
   */
  async function loadMetadata() {
    if (!browserApi || !browserApi.storage || !browserApi.storage.local) return metadata;

    return new Promise((resolve) => {
      try {
        const res = browserApi.storage.local.get(STORAGE_KEY_META, (items) => {
          if (items && items[STORAGE_KEY_META]) {
            metadata = { ...metadata, ...items[STORAGE_KEY_META] };
          }
          resolve(metadata);
        });
        if (res && typeof res.then === 'function') {
          res.then(items => {
            if (items && items[STORAGE_KEY_META]) {
              metadata = { ...metadata, ...items[STORAGE_KEY_META] };
            }
            resolve(metadata);
          }).catch(() => resolve(metadata));
        }
      } catch {
        resolve(metadata);
      }
    });
  }

  /**
   * Save metadata to storage
   */
  async function saveMetadata(newMeta) {
    metadata = { ...metadata, ...newMeta };
    if (!browserApi || !browserApi.storage || !browserApi.storage.local) return;

    return new Promise((resolve) => {
      try {
        const res = browserApi.storage.local.set({ [STORAGE_KEY_META]: metadata }, () => resolve());
        if (res && typeof res.then === 'function') {
          res.then(() => resolve()).catch(() => resolve());
        }
      } catch {
        resolve();
      }
    });
  }

  /**
   * Load cached domain text from storage
   */
  async function loadCachedText() {
    if (!browserApi || !browserApi.storage || !browserApi.storage.local) return null;

    return new Promise((resolve) => {
      try {
        const res = browserApi.storage.local.get(STORAGE_KEY_TEXT, (items) => {
          resolve((items && items[STORAGE_KEY_TEXT]) || null);
        });
        if (res && typeof res.then === 'function') {
          res.then(items => resolve((items && items[STORAGE_KEY_TEXT]) || null)).catch(() => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Load bundled fallback file from extension package (data/community-shopping.txt)
   */
  async function loadBundledText() {
    try {
      if (typeof fetch !== 'undefined' && browserApi && browserApi.runtime && browserApi.runtime.getURL) {
        const url = browserApi.runtime.getURL('data/community-shopping.txt');
        const res = await fetch(url);
        if (res.ok) {
          return await res.text();
        }
      }
    } catch (e) {
      console.debug('DullSopper: loadBundledText error', e);
    }
    return null;
  }

  /**
   * Initialize in-memory domain set.
   * Order of priority:
   * 1. Storage cached text (if previously fetched)
   * 2. Bundled package file
   * 3. Fetch from remote URL
   */
  async function init() {
    if (inMemoryDomainSet) return inMemoryDomainSet;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      await loadMetadata();

      // Check stored cache
      let rawText = await loadCachedText();
      let isFromStorage = !!rawText;

      // If no stored cache, load bundled file
      if (!rawText) {
        rawText = await loadBundledText();
      }

      if (rawText) {
        const domains = parseHosts(rawText);
        inMemoryDomainSet = new Set(domains);
        metadata.domainCount = inMemoryDomainSet.size;
        if (!metadata.lastUpdated) {
          metadata.lastUpdated = Date.now();
          metadata.lastStatus = isFromStorage ? 'loaded_storage' : 'loaded_bundled';
          await saveMetadata(metadata);
        }
      } else {
        // If neither was available, trigger initial fetch
        await fetchAndUpdate(true);
      }

      return inMemoryDomainSet;
    })();

    return initPromise;
  }

  /**
   * Check if a domain (or any parent domain) is present in the community shopping blocklist
   */
  function isCommunityShop(domain) {
    if (!domain || !inMemoryDomainSet) return false;
    let clean = domain.toLowerCase().trim().replace(/^www\./, '');

    // Check exact domain
    if (inMemoryDomainSet.has(clean)) return true;

    // Check parent domains (e.g. "shop.nike.com" -> "nike.com")
    let dotIdx = clean.indexOf('.');
    while (dotIdx !== -1) {
      clean = clean.substring(dotIdx + 1);
      if (clean && inMemoryDomainSet.has(clean)) {
        return true;
      }
      dotIdx = clean.indexOf('.');
    }

    return false;
  }

  /**
   * Fetch latest shopping.txt from GitHub and update cache
   */
  async function fetchAndUpdate(force = false) {
    // If not forced, check if updated within last 12 hours
    if (!force && metadata.lastUpdated) {
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      if (Date.now() - metadata.lastUpdated < twelveHoursMs) {
        return { success: true, updated: false, metadata };
      }
    }

    try {
      console.log('DullSopper: Fetching community blocklist from', LIST_URL);
      const res = await fetch(LIST_URL, { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const rawText = await res.text();
      const domainList = parseHosts(rawText);

      if (domainList.length < 5000) {
        throw new Error(`Downloaded list is suspiciously small (${domainList.length} domains)`);
      }

      // Update in-memory set
      inMemoryDomainSet = new Set(domainList);

      // Save formatted text in storage
      if (browserApi && browserApi.storage && browserApi.storage.local) {
        // Store lines separated by newline
        await new Promise((resolve) => {
          browserApi.storage.local.set({ [STORAGE_KEY_TEXT]: rawText }, () => resolve());
        });
      }

      await saveMetadata({
        domainCount: inMemoryDomainSet.size,
        lastUpdated: Date.now(),
        lastStatus: 'success',
        lastError: null
      });

      console.log(`DullSopper: Community list updated successfully (${inMemoryDomainSet.size} domains)`);
      return { success: true, updated: true, metadata };
    } catch (err) {
      console.warn('DullSopper: Failed to update community blocklist:', err);
      await saveMetadata({
        lastStatus: 'error',
        lastError: err.message
      });
      return { success: false, updated: false, error: err.message, metadata };
    }
  }

  function getMetadata() {
    return { ...metadata };
  }

  function getSetSize() {
    return inMemoryDomainSet ? inMemoryDomainSet.size : 0;
  }

  // Pre-populate for testing or manual injection
  function setDomainsForTesting(domainArray) {
    inMemoryDomainSet = new Set(domainArray.map(d => d.toLowerCase().replace(/^www\./, '')));
    metadata.domainCount = inMemoryDomainSet.size;
  }

  return {
    init,
    parseHosts,
    isCommunityShop,
    fetchAndUpdate,
    getMetadata,
    getSetSize,
    setDomainsForTesting,
    LIST_URL
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.DullSopperCommunityList = DullSopperCommunityList;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DullSopperCommunityList;
}
