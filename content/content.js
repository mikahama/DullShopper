/**
 * DullSopper - Content Script
 * Applies grayscale filters and coordinates with the shop detector and background worker.
 */

(() => {
  // Prevent duplicate execution if script is injected multiple times
  if (window.__dullsopper_injected) return;
  window.__dullsopper_injected = true;

  const currentUrl = window.location.href;
  const currentDomain = DullSopperStorage.cleanDomain(window.location.hostname);
  
  let currentSiteState = null;
  let bannerElement = null;
  let recheckTimeout = null;

  /**
   * Apply CSS filter variables and toggle grayscale class on <html>
   */
  function applyGrayscale(isDulled, settings = {}) {
    const root = document.documentElement;
    if (!root) return;

    if (isDulled) {
      const intensity = (settings.grayscaleIntensity !== undefined) ? settings.grayscaleIntensity : 100;
      const contrast = settings.reduceContrast ? '90%' : '100%';
      const brightness = settings.dimImages ? '90%' : '100%';

      root.style.setProperty('--dullsopper-grayscale', `${intensity}%`);
      root.style.setProperty('--dullsopper-contrast', contrast);
      root.style.setProperty('--dullsopper-brightness', brightness);

      root.classList.add('dullsopper-grayscale');

      if (settings.showBanner) {
        showBannerNotification();
      } else {
        removeBannerNotification();
      }
    } else {
      root.classList.remove('dullsopper-grayscale');
      removeBannerNotification();
    }
  }

  /**
   * Create an unobtrusive banner at top of page if enabled
   */
  function showBannerNotification() {
    if (bannerElement || document.getElementById('dullsopper-notification-banner')) return;
    if (!document.body) return;

    bannerElement = document.createElement('div');
    bannerElement.id = 'dullsopper-notification-banner';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'dullsopper-banner-icon';
    iconSpan.textContent = '😴';

    const textSpan = document.createElement('span');
    textSpan.className = 'dullsopper-banner-text';
    textSpan.textContent = 'DullSopper active: Shop color dulled';

    const allowBtn = document.createElement('button');
    allowBtn.className = 'dullsopper-banner-btn';
    allowBtn.id = 'dullsopper-allow-btn';
    allowBtn.textContent = 'Allow Site';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dullsopper-banner-close';
    closeBtn.id = 'dullsopper-close-btn';
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
        await DullSopperStorage.addToWhitelist(currentDomain);
        applyGrayscale(false);
        // Inform background script of whitelist change
        sendMessageSafely({
          action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
          domain: currentDomain,
          status: DULLSOPPER_CONSTANTS.STATUS.WHITELISTED
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
    const banner = document.getElementById('dullsopper-notification-banner') || bannerElement;
    if (banner && banner.parentNode) {
      banner.classList.add('dullsopper-fade-out');
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
      // Background worker might not be ready or page unloaded
    }
  }

  /**
   * Evaluate page status and apply grayscale
   */
  async function evaluateAndApply(isDomReady = false) {
    // Request authoritative evaluation from background worker (includes Community Shopping Blocklist)
    try {
      const bgResp = await new Promise((resolve) => {
        const api = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);
        if (api && api.sendMessage) {
          api.sendMessage({
            action: DULLSOPPER_CONSTANTS.MESSAGES.GET_PAGE_STATUS,
            url: currentUrl
          }, (res) => resolve(res || null));
        } else {
          resolve(null);
        }
      });

      if (bgResp && bgResp.evaluation) {
        currentSiteState = bgResp.evaluation;
      } else {
        currentSiteState = await DullSopperStorage.evaluateSite(currentDomain);
      }
    } catch {
      currentSiteState = await DullSopperStorage.evaluateSite(currentDomain);
    }

    // Apply immediate grayscale if it's already determined to be dulled
    if (currentSiteState && currentSiteState.isDulled) {
      applyGrayscale(true, currentSiteState.settings);
    } else {
      applyGrayscale(false);
    }

    // If DOM is ready and auto-detection is enabled, run detector engine
    if (isDomReady && currentSiteState.settings.autoDetect && currentSiteState.status !== DULLSOPPER_CONSTANTS.STATUS.WHITELISTED) {
      if (typeof DullSopperDetector !== 'undefined') {
        const detection = DullSopperDetector.analyzePage();
        if (detection.isShop) {
          // Re-evaluate with detected shop flag
          currentSiteState = await DullSopperStorage.evaluateSite(currentDomain, true, detection.reasons);
          
          if (currentSiteState.isDulled) {
            applyGrayscale(true, currentSiteState.settings);
          }

          // Save detected shop to storage
          await DullSopperStorage.saveDetectedShop(currentDomain, {
            reasons: detection.reasons,
            score: detection.score,
            url: currentUrl
          });

          // Report to background script so it can update badge
          sendMessageSafely({
            action: DULLSOPPER_CONSTANTS.MESSAGES.SHOP_DETECTED,
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

  // 3. SPA / Dynamic Navigation Support
  window.addEventListener('popstate', () => {
    clearTimeout(recheckTimeout);
    recheckTimeout = setTimeout(() => evaluateAndApply(true), 500);
  });

  // Re-check after window fully loads (for late-injected scripts or widgets)
  window.addEventListener('load', () => {
    setTimeout(() => evaluateAndApply(true), 800);
  }, { once: true });

  // 4. Listen for commands from popup or background script
  const runtimeApi = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);
  if (runtimeApi && runtimeApi.onMessage) {
    runtimeApi.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;

      switch (message.action) {
        case DULLSOPPER_CONSTANTS.MESSAGES.GET_PAGE_STATUS: {
          const liveDetection = (typeof DullSopperDetector !== 'undefined')
            ? DullSopperDetector.analyzePage()
            : { isShop: false, score: 0, reasons: [] };

          sendResponse({
            state: currentSiteState,
            domain: currentDomain,
            liveDetection
          });
          return true;
        }

        case DULLSOPPER_CONSTANTS.MESSAGES.APPLY_STYLES: {
          if (message.isDulled !== undefined) {
            applyGrayscale(message.isDulled, message.settings || {});
          } else {
            // Re-evaluate from storage
            evaluateAndApply(true);
          }
          sendResponse({ success: true });
          return true;
        }
      }
      return false;
    });
  }
})();
