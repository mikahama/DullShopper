/**
 * DullShopper - Content Script
 * Applies grayscale filters and coordinates with the shop detector and background worker.
 * Features persistent DOM enforcement to prevent SPA hydration (e.g. Next.js, verkkokauppa.com)
 * from resetting colors.
 */

(() => {
  // Prevent duplicate execution if script is injected multiple times
  if (window.__dullshopper_injected) return;
  window.__dullshopper_injected = true;

  const consts = (typeof DULLSHOPPER_CONSTANTS !== 'undefined')
    ? DULLSHOPPER_CONSTANTS
    : (typeof DULLSOPPER_CONSTANTS !== 'undefined' ? DULLSOPPER_CONSTANTS : null);

  const storage = (typeof DullShopperStorage !== 'undefined')
    ? DullShopperStorage
    : (typeof DullSopperStorage !== 'undefined' ? DullSopperStorage : null);

  const detector = (typeof DullShopperDetector !== 'undefined')
    ? DullShopperDetector
    : (typeof DullSopperDetector !== 'undefined' ? DullSopperDetector : null);

  let currentUrl = window.location.href;
  let currentDomain = storage ? storage.cleanDomain(window.location.hostname) : window.location.hostname.replace(/^www\./, '');

  let currentSiteState = null;
  let isCurrentlyDulled = false;
  let currentSettings = {};
  let bannerElement = null;
  let recheckTimeout = null;
  let domObserver = null;
  let isEnforcing = false;

  const STYLE_ELEMENT_ID = 'dullshopper-persistent-filter';

  /**
   * Generates CSS filter string based on user settings
   */
  function buildFilterStyle(settings = {}) {
    const intensity = (settings.grayscaleIntensity !== undefined) ? settings.grayscaleIntensity : 100;
    const contrast = settings.reduceContrast ? '90%' : '100%';
    const brightness = settings.dimImages ? '90%' : '100%';
    return `grayscale(${intensity}%) contrast(${contrast}) brightness(${brightness})`;
  }

  /**
   * Injects or updates persistent <style> element with top-priority specificity
   */
  function ensurePersistentStyle(settings = {}) {
    let styleEl = document.getElementById(STYLE_ELEMENT_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ELEMENT_ID;
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(styleEl);
      }
    }

    const intensity = (settings.grayscaleIntensity !== undefined) ? settings.grayscaleIntensity : (currentSettings.grayscaleIntensity || 100);
    const contrast = (settings.reduceContrast !== undefined) ? (settings.reduceContrast ? '90%' : '100%') : (currentSettings.reduceContrast ? '90%' : '100%');
    const brightness = (settings.dimImages !== undefined) ? (settings.dimImages ? '90%' : '100%') : (currentSettings.dimImages ? '90%' : '100%');

    const cssRule = `
      :root {
        --dullshopper-grayscale: ${intensity}%;
        --dullshopper-contrast: ${contrast};
        --dullshopper-brightness: ${brightness};
      }
      html.dullshopper-grayscale,
      html[data-dullshopper="active"],
      body.dullshopper-grayscale,
      body[data-dullshopper="active"],
      html[data-dullshopper="active"] body,
      html[data-dullshopper="active"] #__next,
      html[data-dullshopper="active"] #root,
      html[data-dullshopper="active"] main {
        filter: grayscale(var(--dullshopper-grayscale, 100%))
                contrast(var(--dullshopper-contrast, 100%))
                brightness(var(--dullshopper-brightness, 100%)) !important;
        -webkit-filter: grayscale(var(--dullshopper-grayscale, 100%))
                        contrast(var(--dullshopper-contrast, 100%))
                        brightness(var(--dullshopper-brightness, 100%)) !important;
      }
    `;

    if (styleEl.textContent !== cssRule) {
      styleEl.textContent = cssRule;
    }
  }

  /**
   * Robust enforcement: re-applies classes, data attributes, inline styles, and style tags
   * whenever any page script (like verkkokauppa's hydration or theme switcher) tries to reset them.
   */
  function enforceGrayscale() {
    if (!isCurrentlyDulled) return;
    if (isEnforcing) return;
    isEnforcing = true;

    try {
      const root = document.documentElement;
      if (!root) return;

      const filterVal = buildFilterStyle(currentSettings);

      // 1. Ensure CSS variables
      root.style.setProperty('--dullshopper-grayscale', `${currentSettings.grayscaleIntensity || 100}%`);
      root.style.setProperty('--dullshopper-contrast', currentSettings.reduceContrast ? '90%' : '100%');
      root.style.setProperty('--dullshopper-brightness', currentSettings.dimImages ? '90%' : '100%');

      // 2. Ensure data-dullshopper attribute (impervious to className.replace scripts)
      if (root.getAttribute('data-dullshopper') !== 'active') {
        root.setAttribute('data-dullshopper', 'active');
      }

      // 3. Ensure class
      if (!root.classList.contains('dullshopper-grayscale')) {
        root.classList.add('dullshopper-grayscale');
      }

      // 4. Ensure inline style filter with !important
      if (root.style.getPropertyValue('filter') !== filterVal) {
        root.style.setProperty('filter', filterVal, 'important');
        root.style.setProperty('-webkit-filter', filterVal, 'important');
      }

      // 5. Ensure body has data-attribute & class if ready
      if (document.body) {
        if (document.body.getAttribute('data-dullshopper') !== 'active') {
          document.body.setAttribute('data-dullshopper', 'active');
        }
        if (!document.body.classList.contains('dullshopper-grayscale')) {
          document.body.classList.add('dullshopper-grayscale');
        }
      }

      // 6. Ensure persistent style tag is in DOM
      ensurePersistentStyle(currentSettings);

      // 7. Banner
      if (currentSettings.showBanner) {
        showBannerNotification();
      } else {
        removeBannerNotification();
      }
    } finally {
      isEnforcing = false;
    }
  }

  /**
   * Completely removes all grayscale filters and helper elements
   */
  function removeGrayscale() {
    isCurrentlyDulled = false;
    const root = document.documentElement;
    if (root) {
      root.removeAttribute('data-dullshopper');
      root.classList.remove('dullshopper-grayscale');
      root.style.removeProperty('filter');
      root.style.removeProperty('-webkit-filter');
      root.style.removeProperty('--dullshopper-grayscale');
      root.style.removeProperty('--dullshopper-contrast');
      root.style.removeProperty('--dullshopper-brightness');
    }

    if (document.body) {
      document.body.removeAttribute('data-dullshopper');
      document.body.classList.remove('dullshopper-grayscale');
      document.body.style.removeProperty('filter');
      document.body.style.removeProperty('-webkit-filter');
    }

    const styleEl = document.getElementById(STYLE_ELEMENT_ID);
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }

    removeBannerNotification();
  }

  /**
   * Start active MutationObserver to defeat anti-grayscale hydration or script overwrites
   */
  function startDomObserver() {
    if (domObserver) return;

    domObserver = new MutationObserver(() => {
      if (isCurrentlyDulled) {
        enforceGrayscale();
      }
    });

    const target = document.documentElement;
    if (target) {
      domObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-dullshopper'],
        childList: true
      });
    }

    // Also observe body when ready
    if (document.body) {
      domObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-dullshopper']
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body && domObserver) {
          domObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'style', 'data-dullshopper']
          });
        }
      }, { once: true });
    }
  }

  /**
   * Primary entry point for toggling grayscale state
   */
  function applyGrayscale(isDulled, settings = {}) {
    currentSettings = { ...currentSettings, ...settings };
    isCurrentlyDulled = isDulled;

    if (isDulled) {
      enforceGrayscale();
      startDomObserver();
    } else {
      removeGrayscale();
    }
  }

  /**
   * Create an unobtrusive banner at top of page if enabled
   */
  function showBannerNotification() {
    if (bannerElement || document.getElementById('dullshopper-notification-banner')) return;
    if (!document.body) return;

    bannerElement = document.createElement('div');
    bannerElement.id = 'dullshopper-notification-banner';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'dullshopper-banner-icon';
    iconSpan.textContent = '😴';

    const textSpan = document.createElement('span');
    textSpan.className = 'dullshopper-banner-text';
    textSpan.textContent = 'DullShopper active: Shop color dulled';

    const allowBtn = document.createElement('button');
    allowBtn.className = 'dullshopper-banner-btn';
    allowBtn.id = 'dullshopper-allow-btn';
    allowBtn.textContent = 'Allow Site';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dullshopper-banner-close';
    closeBtn.id = 'dullshopper-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    bannerElement.appendChild(iconSpan);
    bannerElement.appendChild(textSpan);
    bannerElement.appendChild(allowBtn);
    bannerElement.appendChild(closeBtn);

    document.body.appendChild(bannerElement);

    if (allowBtn) {
      allowBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (storage) await storage.addToWhitelist(currentDomain);
        applyGrayscale(false);
        sendMessageSafely({
          action: (consts && consts.MESSAGES) ? consts.MESSAGES.SET_DOMAIN_STATUS : 'DULLSHOPPER_SET_DOMAIN_STATUS',
          domain: currentDomain,
          status: (consts && consts.STATUS) ? consts.STATUS.WHITELISTED : 'whitelisted'
        });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeBannerNotification();
      });
    }
  }

  function removeBannerNotification() {
    const banner = document.getElementById('dullshopper-notification-banner') || bannerElement;
    if (banner && banner.parentNode) {
      banner.classList.add('dullshopper-fade-out');
      setTimeout(() => {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
        bannerElement = null;
      }, 300);
    }
  }

  /**
   * Safe runtime message sender
   */
  function sendMessageSafely(msg) {
    try {
      const api = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);
      if (api && api.sendMessage) {
        api.sendMessage(msg).catch(() => {});
      }
    } catch {
      // Ignore background communication errors
    }
  }

  /**
   * Evaluate page status and apply grayscale
   */
  async function evaluateAndApply(isDomReady = false) {
    currentUrl = window.location.href;
    currentDomain = storage ? storage.cleanDomain(window.location.hostname) : window.location.hostname.replace(/^www\./, '');

    // Request authoritative evaluation from background worker (includes Community Shopping Blocklist)
    try {
      const bgResp = await new Promise((resolve) => {
        const api = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);
        if (api && api.sendMessage) {
          api.sendMessage({
            action: (consts && consts.MESSAGES) ? consts.MESSAGES.GET_PAGE_STATUS : 'DULLSHOPPER_GET_PAGE_STATUS',
            url: currentUrl
          }, (res) => resolve(res || null));
        } else {
          resolve(null);
        }
      });

      if (bgResp && bgResp.evaluation) {
        currentSiteState = bgResp.evaluation;
      } else if (storage) {
        currentSiteState = await storage.evaluateSite(currentDomain);
      }
    } catch {
      if (storage) {
        currentSiteState = await storage.evaluateSite(currentDomain);
      }
    }

    // Apply immediate grayscale if it's determined to be dulled
    if (currentSiteState && currentSiteState.isDulled) {
      applyGrayscale(true, currentSiteState.settings);
    } else {
      applyGrayscale(false);
    }

    // If DOM is ready and auto-detection is enabled, run detector engine
    if (isDomReady && currentSiteState && currentSiteState.settings && currentSiteState.settings.autoDetect && currentSiteState.status !== ((consts && consts.STATUS) ? consts.STATUS.WHITELISTED : 'whitelisted')) {
      if (detector) {
        const detection = detector.analyzePage();
        if (detection.isShop) {
          // Re-evaluate with detected shop flag
          if (storage) {
            currentSiteState = await storage.evaluateSite(currentDomain, true, detection.reasons);
            if (currentSiteState.isDulled) {
              applyGrayscale(true, currentSiteState.settings);
            }

            // Save detected shop to storage
            await storage.saveDetectedShop(currentDomain, {
              reasons: detection.reasons,
              score: detection.score,
              url: currentUrl
            });
          }

          // Report to background script so it can update badge
          sendMessageSafely({
            action: (consts && consts.MESSAGES) ? consts.MESSAGES.SHOP_DETECTED : 'DULLSHOPPER_SHOP_DETECTED',
            domain: currentDomain,
            url: currentUrl,
            reasons: detection.reasons,
            score: detection.score
          });
        }
      }
    }
  }

  // 1. Instant check at document_start
  evaluateAndApply(false);

  // 2. Full heuristic check when DOM is interactive/complete
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      evaluateAndApply(true);
    }, { once: true });
  } else {
    evaluateAndApply(true);
  }

  // 3. SPA / Dynamic Navigation Support (Next.js / verkkokauppa.com route changes)
  function handleSpaTransition() {
    clearTimeout(recheckTimeout);
    recheckTimeout = setTimeout(() => {
      evaluateAndApply(true);
    }, 200);
  }

  window.addEventListener('popstate', handleSpaTransition);

  // Monkey patch pushState and replaceState to detect Next.js / React client-side route changes
  try {
    const originalPushState = history.pushState;
    if (typeof originalPushState === 'function') {
      history.pushState = function(...args) {
        const result = originalPushState.apply(this, args);
        handleSpaTransition();
        return result;
      };
    }

    const originalReplaceState = history.replaceState;
    if (typeof originalReplaceState === 'function') {
      history.replaceState = function(...args) {
        const result = originalReplaceState.apply(this, args);
        handleSpaTransition();
        return result;
      };
    }
  } catch (e) {
    console.debug('DullShopper: history patch error', e);
  }

  // Re-check after window fully loads (for late-injected scripts or widgets)
  window.addEventListener('load', () => {
    setTimeout(() => evaluateAndApply(true), 500);
    setTimeout(() => enforceGrayscale(), 1200);
  }, { once: true });

  // 4. Listen for commands from popup or background script
  const runtimeApi = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);
  if (runtimeApi && runtimeApi.onMessage) {
    runtimeApi.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;

      const msgName = message.action;

      if (msgName.includes('GET_PAGE_STATUS')) {
        const liveDetection = detector ? detector.analyzePage() : { isShop: false, score: 0, reasons: [] };
        sendResponse({
          state: currentSiteState,
          domain: currentDomain,
          liveDetection
        });
        return true;
      }

      if (msgName.includes('APPLY_STYLES')) {
        if (message.isDulled !== undefined) {
          applyGrayscale(message.isDulled, message.settings || {});
        } else {
          evaluateAndApply(true);
        }
        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }
})();
