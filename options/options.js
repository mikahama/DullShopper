/**
 * DullSopper - Options & Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;

  const consts = (typeof DULLSHOPPER_CONSTANTS !== 'undefined')
    ? DULLSHOPPER_CONSTANTS
    : (typeof DULLSOPPER_CONSTANTS !== 'undefined' ? DULLSOPPER_CONSTANTS : null);

  const storage = (typeof DullShopperStorage !== 'undefined')
    ? DullShopperStorage
    : (typeof DullSopperStorage !== 'undefined' ? DullSopperStorage : null);

  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const detectedCounter = document.getElementById('detected-counter');

  // Lists elements
  const addBlocklistInput = document.getElementById('add-blocklist-input');
  const addBlocklistBtn = document.getElementById('add-blocklist-btn');
  const blocklistMsg = document.getElementById('blocklist-msg');
  const filterBlocklist = document.getElementById('filter-blocklist');
  const blocklistItems = document.getElementById('blocklist-items');
  const blocklistCount = document.getElementById('blocklist-count');

  const addWhitelistInput = document.getElementById('add-whitelist-input');
  const addWhitelistBtn = document.getElementById('add-whitelist-btn');
  const whitelistMsg = document.getElementById('whitelist-msg');
  const filterWhitelist = document.getElementById('filter-whitelist');
  const whitelistItems = document.getElementById('whitelist-items');
  const whitelistCount = document.getElementById('whitelist-count');

  // Detected shops elements
  const detectedShopsTbody = document.getElementById('detected-shops-tbody');
  const filterDetected = document.getElementById('filter-detected');
  const clearDetectedBtn = document.getElementById('clear-detected-btn');

  // Settings elements
  const settingAutodetect = document.getElementById('setting-autodetect');
  const settingPreloaded = document.getElementById('setting-preloaded');
  const settingIntensity = document.getElementById('setting-intensity');
  const settingIntensityDisplay = document.getElementById('setting-intensity-display');
  const settingContrast = document.getElementById('setting-contrast');
  const settingDim = document.getElementById('setting-dim');
  const settingBadge = document.getElementById('setting-badge');
  const settingBanner = document.getElementById('setting-banner');

  // Community Blocklist elements
  const communityCounter = document.getElementById('community-counter');
  const updateCommunityBtn = document.getElementById('update-community-btn');
  const updateCommunityIcon = document.getElementById('update-community-icon');
  const updateCommunityText = document.getElementById('update-community-text');
  const communityStatusBadge = document.getElementById('community-status-badge');
  const communityDomainsCount = document.getElementById('community-domains-count');
  const communityLastUpdated = document.getElementById('community-last-updated');
  const communityUpdateMsg = document.getElementById('community-update-msg');
  const settingCommunityEnabled = document.getElementById('setting-community-enabled');
  const settingCommunityAutoupdate = document.getElementById('setting-community-autoupdate');
  const testCommunityInput = document.getElementById('test-community-input');
  const testCommunityBtn = document.getElementById('test-community-btn');
  const testCommunityResult = document.getElementById('test-community-result');

  // Backup & Restore
  const exportBtn = document.getElementById('export-json-btn');
  const importBtn = document.getElementById('import-json-btn');
  const importFileInput = document.getElementById('import-file-input');
  const importFeedback = document.getElementById('import-feedback');

  // Local state cache
  let blocklist = [];
  let whitelist = [];
  let detectedShops = {};
  let currentSettings = {};

  /**
   * Helper: Send message to background script
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
   * Initialize and load data
   */
  async function loadAllData() {
    blocklist = await DullSopperStorage.getBlocklist();
    whitelist = await DullSopperStorage.getWhitelist();
    detectedShops = await DullSopperStorage.getDetectedShops();
    currentSettings = await DullSopperStorage.getSettings();

    renderBlocklist();
    renderWhitelist();
    renderDetectedShops();
    renderSettings();
    await renderCommunityStatus();
  }

  /**
   * Render Community Blocklist stats and status
   */
  async function renderCommunityStatus() {
    const resp = await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.GET_COMMUNITY_STATUS
    });

    const meta = (resp && resp.metadata) ? resp.metadata : {};
    const count = meta.domainCount || 0;
    const formattedCount = count > 0 ? count.toLocaleString() : '188,800+';

    if (communityCounter) {
      communityCounter.textContent = count > 0 ? `${Math.round(count / 1000)}k` : '188k';
    }
    if (communityDomainsCount) {
      communityDomainsCount.textContent = `${formattedCount} domains`;
    }

    if (communityLastUpdated) {
      if (meta.lastUpdated) {
        communityLastUpdated.textContent = new Date(meta.lastUpdated).toLocaleString();
      } else {
        communityLastUpdated.textContent = 'Bundled database';
      }
    }

    if (communityStatusBadge) {
      if (meta.lastStatus === 'error') {
        communityStatusBadge.className = 'badge';
        communityStatusBadge.style.color = 'var(--danger-color)';
        communityStatusBadge.textContent = 'Sync issue (Using cache)';
      } else {
        communityStatusBadge.className = 'badge';
        communityStatusBadge.style.color = 'var(--success-color)';
        communityStatusBadge.textContent = 'Active & Synchronized';
      }
    }
  }

  // --- Tab Navigation ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTabId = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // --- Render Blocklist ---
  function renderBlocklist() {
    const filter = (filterBlocklist.value || '').toLowerCase();
    while (blocklistItems.firstChild) {
      blocklistItems.removeChild(blocklistItems.firstChild);
    }
    const filtered = blocklist.filter(d => d.toLowerCase().includes(filter));

    blocklistCount.textContent = `${blocklist.length} ${blocklist.length === 1 ? 'site' : 'sites'}`;

    if (filtered.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'No sites in dull list.';
      blocklistItems.appendChild(emptyLi);
      return;
    }

    filtered.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'domain-name';
      nameSpan.textContent = domain;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'domain-actions';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.title = 'Remove from dull list';
      delBtn.textContent = '✕';

      delBtn.addEventListener('click', async () => {
        await DullSopperStorage.removeFromBlocklist(domain);
        await sendBackgroundMessage({
          action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
          domain,
          status: DULLSOPPER_CONSTANTS.STATUS.NORMAL
        });
        blocklist = await DullSopperStorage.getBlocklist();
        renderBlocklist();
      });

      actionsDiv.appendChild(delBtn);
      li.appendChild(nameSpan);
      li.appendChild(actionsDiv);
      blocklistItems.appendChild(li);
    });
  }

  // --- Render Whitelist ---
  function renderWhitelist() {
    const filter = (filterWhitelist.value || '').toLowerCase();
    while (whitelistItems.firstChild) {
      whitelistItems.removeChild(whitelistItems.firstChild);
    }
    const filtered = whitelist.filter(d => d.toLowerCase().includes(filter));

    whitelistCount.textContent = `${whitelist.length} ${whitelist.length === 1 ? 'site' : 'sites'}`;

    if (filtered.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'No sites in allowed list.';
      whitelistItems.appendChild(emptyLi);
      return;
    }

    filtered.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'domain-name';
      nameSpan.textContent = domain;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'domain-actions';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.title = 'Remove from allowed list';
      delBtn.textContent = '✕';

      delBtn.addEventListener('click', async () => {
        await DullSopperStorage.removeFromWhitelist(domain);
        await sendBackgroundMessage({
          action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
          domain,
          status: DULLSOPPER_CONSTANTS.STATUS.NORMAL
        });
        whitelist = await DullSopperStorage.getWhitelist();
        renderWhitelist();
      });

      actionsDiv.appendChild(delBtn);
      li.appendChild(nameSpan);
      li.appendChild(actionsDiv);
      whitelistItems.appendChild(li);
    });
  }

  // --- Render Detected Shops ---
  function renderDetectedShops() {
    const filter = (filterDetected.value || '').toLowerCase();
    while (detectedShopsTbody.firstChild) {
      detectedShopsTbody.removeChild(detectedShopsTbody.firstChild);
    }

    const list = Object.values(detectedShops);
    detectedCounter.textContent = String(list.length);

    const filtered = list.filter(item => {
      return (item.domain && item.domain.toLowerCase().includes(filter)) ||
             (item.reasons && item.reasons.some(r => r.toLowerCase().includes(filter)));
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.className = 'empty-state';
      td.textContent = 'No web shops detected yet. Browse web stores to see them automatically recorded here!';
      tr.appendChild(td);
      detectedShopsTbody.appendChild(tr);
      return;
    }

    // Sort newest first
    filtered.sort((a, b) => (b.detectedAt || 0) - (a.detectedAt || 0));

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      // Domain cell
      const tdDomain = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = item.domain;
      tdDomain.appendChild(strong);

      // Reasons cell
      const tdReasons = document.createElement('td');
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'reasons-tags';

      const reasons = (item.reasons && item.reasons.length > 0) ? item.reasons : ['Web Store'];
      reasons.forEach(r => {
        const tag = document.createElement('span');
        tag.className = 'reason-tag';
        tag.textContent = r;
        tagsDiv.appendChild(tag);
      });
      tdReasons.appendChild(tagsDiv);

      // Date cell
      const tdDate = document.createElement('td');
      tdDate.style.color = 'var(--text-muted)';
      tdDate.style.fontSize = '12px';
      tdDate.textContent = item.detectedAt ? new Date(item.detectedAt).toLocaleDateString() : 'Recent';

      // Actions cell
      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      const actionGroup = document.createElement('div');
      actionGroup.style.display = 'inline-flex';
      actionGroup.style.gap = '6px';

      const allowBtn = document.createElement('button');
      allowBtn.className = 'btn btn-secondary btn-small';
      allowBtn.textContent = 'Allow';
      allowBtn.addEventListener('click', async () => {
        await DullSopperStorage.addToWhitelist(item.domain);
        await sendBackgroundMessage({
          action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
          domain: item.domain,
          status: DULLSOPPER_CONSTANTS.STATUS.WHITELISTED
        });
        whitelist = await DullSopperStorage.getWhitelist();
        renderWhitelist();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-small';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await DullSopperStorage.removeDetectedShop(item.domain);
        detectedShops = await DullSopperStorage.getDetectedShops();
        renderDetectedShops();
      });

      actionGroup.appendChild(allowBtn);
      actionGroup.appendChild(delBtn);
      tdActions.appendChild(actionGroup);

      tr.appendChild(tdDomain);
      tr.appendChild(tdReasons);
      tr.appendChild(tdDate);
      tr.appendChild(tdActions);

      detectedShopsTbody.appendChild(tr);
    });
  }

  // --- Render Settings Form ---
  function renderSettings() {
    settingAutodetect.checked = !!currentSettings.autoDetect;
    settingPreloaded.checked = !!currentSettings.includePreloadedShops;
    settingIntensity.value = currentSettings.grayscaleIntensity || 100;
    settingIntensityDisplay.textContent = `${settingIntensity.value}%`;
    settingContrast.checked = !!currentSettings.reduceContrast;
    settingDim.checked = !!currentSettings.dimImages;
    settingBadge.checked = !!currentSettings.showBadge;
    settingBanner.checked = !!currentSettings.showBanner;
    if (settingCommunityEnabled) settingCommunityEnabled.checked = currentSettings.useCommunityBlocklist !== false;
    if (settingCommunityAutoupdate) settingCommunityAutoupdate.checked = currentSettings.autoUpdateCommunityList !== false;
  }

  // --- Add to Blocklist Event ---
  addBlocklistBtn.addEventListener('click', handleAddBlocklist);
  addBlocklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddBlocklist();
  });

  async function handleAddBlocklist() {
    const raw = addBlocklistInput.value.trim();
    const domain = DullSopperStorage.cleanDomain(raw);

    if (!domain || !domain.includes('.')) {
      showMsg(blocklistMsg, 'Please enter a valid domain (e.g. store.com)', true);
      return;
    }

    await DullSopperStorage.addToBlocklist(domain);
    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
      domain,
      status: DULLSOPPER_CONSTANTS.STATUS.DULLED_BLOCKED
    });

    addBlocklistInput.value = '';
    showMsg(blocklistMsg, `Added ${domain} to Dull List!`, false);
    blocklist = await DullSopperStorage.getBlocklist();
    whitelist = await DullSopperStorage.getWhitelist();
    renderBlocklist();
    renderWhitelist();
  }

  // --- Add to Whitelist Event ---
  addWhitelistBtn.addEventListener('click', handleAddWhitelist);
  addWhitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddWhitelist();
  });

  async function handleAddWhitelist() {
    const raw = addWhitelistInput.value.trim();
    const domain = DullSopperStorage.cleanDomain(raw);

    if (!domain || !domain.includes('.')) {
      showMsg(whitelistMsg, 'Please enter a valid domain (e.g. essentialshop.com)', true);
      return;
    }

    await DullSopperStorage.addToWhitelist(domain);
    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.SET_DOMAIN_STATUS,
      domain,
      status: DULLSOPPER_CONSTANTS.STATUS.WHITELISTED
    });

    addWhitelistInput.value = '';
    showMsg(whitelistMsg, `Added ${domain} to Allowed List!`, false);
    whitelist = await DullSopperStorage.getWhitelist();
    blocklist = await DullSopperStorage.getBlocklist();
    renderWhitelist();
    renderBlocklist();
  }

  // Filter input listeners
  filterBlocklist.addEventListener('input', renderBlocklist);
  filterWhitelist.addEventListener('input', renderWhitelist);
  filterDetected.addEventListener('input', renderDetectedShops);

  // Clear detected history
  clearDetectedBtn.addEventListener('click', async () => {
    if (confirm('Clear all automatically detected shops history?')) {
      await DullSopperStorage.clearDetectedShops();
      detectedShops = await DullSopperStorage.getDetectedShops();
      renderDetectedShops();
    }
  });

  // Settings change listeners
  async function saveSettingChange(key, value) {
    currentSettings[key] = value;
    await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.UPDATE_SETTINGS,
      settings: { [key]: value }
    });
  }

  settingAutodetect.addEventListener('change', () => saveSettingChange('autoDetect', settingAutodetect.checked));
  settingPreloaded.addEventListener('change', () => saveSettingChange('includePreloadedShops', settingPreloaded.checked));
  settingContrast.addEventListener('change', () => saveSettingChange('reduceContrast', settingContrast.checked));
  settingDim.addEventListener('change', () => saveSettingChange('dimImages', settingDim.checked));
  settingBadge.addEventListener('change', () => saveSettingChange('showBadge', settingBadge.checked));
  settingBanner.addEventListener('change', () => saveSettingChange('showBanner', settingBanner.checked));

  settingIntensity.addEventListener('input', () => {
    const val = parseInt(settingIntensity.value, 10);
    settingIntensityDisplay.textContent = `${val}%`;
  });

  settingIntensity.addEventListener('change', () => {
    const val = parseInt(settingIntensity.value, 10);
    saveSettingChange('grayscaleIntensity', val);
  });

  // Community List settings listeners
  if (settingCommunityEnabled) {
    settingCommunityEnabled.addEventListener('change', () => {
      saveSettingChange('useCommunityBlocklist', settingCommunityEnabled.checked);
    });
  }

  if (settingCommunityAutoupdate) {
    settingCommunityAutoupdate.addEventListener('change', () => {
      saveSettingChange('autoUpdateCommunityList', settingCommunityAutoupdate.checked);
    });
  }

  // Update Community List Now Button
  if (updateCommunityBtn) {
    updateCommunityBtn.addEventListener('click', async () => {
      updateCommunityBtn.disabled = true;
      if (updateCommunityText) updateCommunityText.textContent = 'Updating...';
      if (updateCommunityIcon) updateCommunityIcon.textContent = '⏳';

      const res = await sendBackgroundMessage({
        action: DULLSOPPER_CONSTANTS.MESSAGES.UPDATE_COMMUNITY_LIST
      });

      updateCommunityBtn.disabled = false;
      if (updateCommunityIcon) updateCommunityIcon.textContent = '🔄';
      if (updateCommunityText) updateCommunityText.textContent = 'Update List Now';

      if (res && res.success) {
        showMsg(communityUpdateMsg, `Successfully updated! ${res.metadata ? res.metadata.domainCount.toLocaleString() : ''} domains loaded.`, false);
      } else {
        showMsg(communityUpdateMsg, `Update error: ${res.error || 'Network error'} (Existing list preserved)`, true);
      }

      await renderCommunityStatus();
    });
  }

  // Test domain in community list
  if (testCommunityBtn) {
    testCommunityBtn.addEventListener('click', handleTestCommunity);
    if (testCommunityInput) {
      testCommunityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleTestCommunity();
      });
    }
  }

  async function handleTestCommunity() {
    const raw = testCommunityInput ? testCommunityInput.value.trim() : '';
    const domain = DullSopperStorage.cleanDomain(raw);
    if (!domain) {
      showMsg(testCommunityResult, 'Please enter a valid domain to check', true);
      return;
    }

    const data = await sendBackgroundMessage({
      action: DULLSOPPER_CONSTANTS.MESSAGES.GET_POPUP_DATA,
      url: domain
    });

    if (data && data.isCommunity) {
      showMsg(testCommunityResult, `✓ "${domain}" is on the Community Shopping Blocklist!`, false);
    } else {
      showMsg(testCommunityResult, `✗ "${domain}" is NOT in the Community Shopping Blocklist.`, true);
    }
  }

  // --- Export Backup ---
  exportBtn.addEventListener('click', async () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: await DullSopperStorage.getSettings(),
      blocklist: await DullSopperStorage.getBlocklist(),
      whitelist: await DullSopperStorage.getWhitelist(),
      detectedShops: await DullSopperStorage.getDetectedShops()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dullsopper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // --- Import Backup ---
  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        if (Array.isArray(data.blocklist)) {
          for (const d of data.blocklist) {
            await DullSopperStorage.addToBlocklist(d);
          }
        }
        if (Array.isArray(data.whitelist)) {
          for (const d of data.whitelist) {
            await DullSopperStorage.addToWhitelist(d);
          }
        }
        if (data.settings && typeof data.settings === 'object') {
          await DullSopperStorage.saveSettings(data.settings);
        }

        showMsg(importFeedback, 'Configuration imported successfully!', false);
        await loadAllData();
      } catch (err) {
        showMsg(importFeedback, `Import failed: ${err.message}`, true);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // Helpers
  function showMsg(el, text, isError) {
    el.textContent = text;
    el.className = isError ? 'feedback-text error' : 'feedback-text';
    el.classList.remove('hidden');
    setTimeout(() => {
      el.classList.add('hidden');
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load initial data
  await loadAllData();
});
