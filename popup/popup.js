/**
 * DullSopper - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;

  const consts = (typeof DULLSHOPPER_CONSTANTS !== 'undefined')
    ? DULLSHOPPER_CONSTANTS
    : (typeof DULLSOPPER_CONSTANTS !== 'undefined' ? DULLSOPPER_CONSTANTS : null);

  const storage = (typeof DullShopperStorage !== 'undefined')
    ? DullShopperStorage
    : (typeof DullSopperStorage !== 'undefined' ? DullSopperStorage : null);

  // DOM Elements
  const globalToggle = document.getElementById('global-toggle');
  const globalDisabledBanner = document.getElementById('global-disabled-banner');
  const siteDomainEl = document.getElementById('site-domain');
  const siteStatusBadge = document.getElementById('site-status-badge');
  const detectionBox = document.getElementById('detection-reasons-box');
  const detectionReasonsList = document.getElementById('detection-reasons-list');
  const toggleSiteBtn = document.getElementById('toggle-site-btn');
  const toggleSiteIcon = document.getElementById('toggle-site-icon');
  const toggleSiteText = document.getElementById('toggle-site-text');
  const resetSiteBtn = document.getElementById('reset-site-btn');
  const quickInput = document.getElementById('quick-domain-input');
  const quickAddBtn = document.getElementById('quick-add-btn');
  const quickFeedback = document.getElementById('quick-add-feedback');
  const grayscaleSlider = document.getElementById('grayscale-slider');
  const intensityVal = document.getElementById('intensity-val');
  const footerStats = document.getElementById('footer-stats');
  const openSettingsLink = document.getElementById('open-settings-link');

  let currentDomain = '';
  let currentTabId = null;
  let currentEvaluation = null;
  let isCurrentDulled = false;
  let isCurrentBlocked = false;
  let isCurrentWhitelisted = false;

  /**
   * Safe message dispatcher to background script
   */
  async function sendBackgroundMessage(msg) {
    return new Promise((resolve) => {
      try {
        browserApi.runtime.sendMessage(msg, (res) => {
          resolve(res || {});
        });
      } catch (e) {
        resolve({ error: e.message });
      }
    });
  }

  /**
   * Load active tab and refresh state
   */
  async function init() {
    try {
      const tabs = await browserApi.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs && tabs[0];

      if (!activeTab || !activeTab.url || activeTab.url.startsWith('about:') || activeTab.url.startsWith('chrome:')) {
        siteDomainEl.textContent = 'Special Browser Page';
        siteStatusBadge.className = 'badge badge-normal';
        siteStatusBadge.textContent = 'Inactive';
        toggleSiteBtn.classList.add('hidden');
        return;
      }

      currentTabId = activeTab.id;
      currentDomain = DullSopperStorage.cleanDomain(activeTab.url);
      siteDomainEl.textContent = currentDomain || 'unknown';

      await refreshState(activeTab.url);
    } catch (err) {
      console.error('DullSopper: init error', err);
    }
  }

  /**
   * Refresh and render all UI elements
   */
  async function refreshState(tabUrl) {
    const data = await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.GET_POPUP_DATA,
      url: tabUrl
    });

    if (!data || !data.evaluation) return;

    currentEvaluation = data.evaluation;
    const settings = currentEvaluation.settings;
    isCurrentDulled = currentEvaluation.isDulled;
    isCurrentBlocked = data.isBlocked;
    isCurrentWhitelisted = data.isWhitelisted;

    // 1. Global toggle
    globalToggle.checked = settings.enabled;
    if (!settings.enabled) {
      globalDisabledBanner.classList.remove('hidden');
    } else {
      globalDisabledBanner.classList.add('hidden');
    }

    // 2. Grayscale slider
    grayscaleSlider.value = settings.grayscaleIntensity;
    intensityVal.textContent = `${settings.grayscaleIntensity}%`;

    // 3. Status Badge and Reasons
    renderStatusBadge(currentEvaluation, data.isDetected, data.detectedInfo);

    // 4. Primary Site Action Button
    renderSiteButtons();

    // 5. Footer stats
    footerStats.textContent = `${data.totalBlocked} blocked • ${data.totalWhitelisted} allowed`;
  }

  function renderStatusBadge(evaluation, isDetected, detectedInfo) {
    detectionBox.classList.add('hidden');
    while (detectionReasonsList.firstChild) {
      detectionReasonsList.removeChild(detectionReasonsList.firstChild);
    }

    if (!evaluation.settings.enabled) {
      siteStatusBadge.className = 'badge badge-normal';
      siteStatusBadge.textContent = 'Paused';
      return;
    }

    if (isCurrentWhitelisted) {
      siteStatusBadge.className = 'badge badge-green';
      siteStatusBadge.textContent = '🌈 Allowed (Color)';
      return;
    }

    if (isCurrentBlocked) {
      siteStatusBadge.className = 'badge badge-gray';
      siteStatusBadge.textContent = '🔒 Dull (Blocklist)';
      return;
    }

    if (evaluation.status === DULLSOPPER_CONSTANTS.STATUS.DULLED_PRELOADED) {
      siteStatusBadge.className = 'badge badge-gray';
      siteStatusBadge.textContent = '🛍️ Dull (Top Retailer)';
      return;
    }

    if (evaluation.status === DULLSOPPER_CONSTANTS.STATUS.DULLED_COMMUNITY) {
      siteStatusBadge.className = 'badge badge-gray';
      siteStatusBadge.textContent = '🛍️ Dull (Community List)';
      detectionBox.classList.remove('hidden');
      const li = document.createElement('li');
      li.textContent = 'Listed in Community Shopping Blocklist';
      detectionReasonsList.appendChild(li);
      return;
    }

    if (evaluation.status === DULLSOPPER_CONSTANTS.STATUS.DULLED_DETECTED || isDetected) {
      siteStatusBadge.className = 'badge badge-gray';
      siteStatusBadge.textContent = '😴 Dull (Shop Detected)';

      const reasons = evaluation.reasons || (detectedInfo ? detectedInfo.reasons : []);
      if (reasons && reasons.length > 0) {
        detectionBox.classList.remove('hidden');
        reasons.forEach(r => {
          const li = document.createElement('li');
          li.textContent = r;
          detectionReasonsList.appendChild(li);
        });
      }
      return;
    }

    // Normal website
    siteStatusBadge.className = 'badge badge-normal';
    siteStatusBadge.textContent = '⚪ Normal Site';
  }

  function renderSiteButtons() {
    toggleSiteBtn.classList.remove('hidden');

    if (isCurrentDulled) {
      // Current site is dull -> action is to disable / restore color
      toggleSiteBtn.className = 'btn btn-restore';
      toggleSiteIcon.textContent = '🌈';
      toggleSiteText.textContent = 'Allow on this site (Restore color)';
    } else {
      // Current site is normal or allowed -> action is to dull it
      toggleSiteBtn.className = 'btn btn-primary';
      toggleSiteIcon.textContent = '🩶';
      toggleSiteText.textContent = 'Dull this site (Add to Dull List)';
    }

    // Show reset button if custom rule is active
    if (isCurrentBlocked || isCurrentWhitelisted) {
      resetSiteBtn.classList.remove('hidden');
    } else {
      resetSiteBtn.classList.add('hidden');
    }
  }

  // --- Event Listeners ---

  // Global toggle
  globalToggle.addEventListener('change', async () => {
    const enabled = globalToggle.checked;
    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.UPDATE_SETTINGS,
      settings: { enabled }
    });
    if (currentDomain) {
      await refreshState(currentDomain);
    }
  });

  // Toggle current site action
  toggleSiteBtn.addEventListener('click', async () => {
    if (!currentDomain) return;

    if (isCurrentDulled) {
      // Whitelist this site
      await sendBackgroundMessage({
        action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
        domain: currentDomain,
        status: DULLSOPPER_CONSTANTS.STATUS.WHITELISTED
      });
    } else {
      // Block / Dull this site
      await sendBackgroundMessage({
        action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
        domain: currentDomain,
        status: DULLSOPPER_CONSTANTS.STATUS.DULLED_BLOCKED
      });
    }

    await refreshState(currentDomain);
  });

  // Reset current site
  resetSiteBtn.addEventListener('click', async () => {
    if (!currentDomain) return;

    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
      domain: currentDomain,
      status: DULLSOPPER_CONSTANTS.STATUS.NORMAL
    });

    await refreshState(currentDomain);
  });

  // Quick Add domain to blocklist
  quickAddBtn.addEventListener('click', handleQuickAdd);
  quickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleQuickAdd();
  });

  async function handleQuickAdd() {
    const rawVal = quickInput.value.trim();
    const domain = DullSopperStorage.cleanDomain(rawVal);

    if (!domain || !domain.includes('.')) {
      showFeedback('Please enter a valid domain (e.g. example.com)', true);
      return;
    }

    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
      domain,
      status: DULLSOPPER_CONSTANTS.STATUS.DULLED_BLOCKED
    });

    quickInput.value = '';
    showFeedback(`Added ${domain} to Dull List!`, false);

    if (currentDomain) {
      await refreshState(currentDomain);
    }
  }

  function showFeedback(msg, isError) {
    quickFeedback.textContent = msg;
    quickFeedback.className = isError ? 'feedback-msg error' : 'feedback-msg';
    quickFeedback.classList.remove('hidden');
    setTimeout(() => {
      quickFeedback.classList.add('hidden');
    }, 2800);
  }

  // Grayscale Slider
  let sliderDebounce;
  grayscaleSlider.addEventListener('input', () => {
    const val = parseInt(grayscaleSlider.value, 10);
    intensityVal.textContent = `${val}%`;

    clearTimeout(sliderDebounce);
    sliderDebounce = setTimeout(async () => {
      await sendBackgroundMessage({
        action: DULLSOPPER_CONSTANTS.MESSAGES.UPDATE_SETTINGS,
        settings: { grayscaleIntensity: val }
      });
    }, 150);
  });

  // Open Options page
  openSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (browserApi.runtime.openOptionsPage) {
      browserApi.runtime.openOptionsPage();
    } else {
      window.open(browserApi.runtime.getURL('options/options.html'));
    }
  });

  // Initialize popup
  init();
});
