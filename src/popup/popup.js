// Crixen - Popup Script
// Using NEAR AI Cloud API

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadSettings();
    setupEventListeners();
    // Check initial tab status
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab) switchTab(activeTab);
}

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {
                selectedModel: 'deepseek-ai/DeepSeek-V3.1',
                apiKey: '',
                defaultStyle: 'friendly',
                customPrompt: '',
                lastTab: 'instagram',
                capturedStrategies: [] // New: Store Notion strategies
            };

            // Set provider/model
            const modelRadio = document.querySelector(`input[value="${settings.selectedModel}"]`);
            if (modelRadio) {
                modelRadio.checked = true;
            } else {
                const fallback = document.querySelector('input[value="deepseek-ai/DeepSeek-V3.1"]');
                if (fallback) fallback.checked = true;
            }

            // Set API key
            document.getElementById('apiKey').value = settings.apiKey || '';

            // Set default style
            document.getElementById('defaultStyle').value = settings.defaultStyle || 'friendly';

            // Set instructions
            const instructionEl = document.getElementById('instructions');
            if (instructionEl) instructionEl.value = settings.instructions || '';

            // Show/hide custom prompt
            toggleCustomPrompt(settings.defaultStyle === 'custom');
            if (settings.customPrompt) {
                document.getElementById('customPrompt').value = settings.customPrompt;
            }

            // Render captured strategies
            renderStrategies(settings.capturedStrategies || []);

            // Restore last active tab
            switchTab(settings.lastTab || 'instagram');

            resolve();
        });
    });
}

function renderStrategies(strategies) {
    const list = document.getElementById('capturedStrategiesList');
    if (!list) return;

    if (!strategies || strategies.length === 0) {
        list.innerHTML = '<div class="info-box">None yet. Open Notion and Capture.</div>';
        return;
    }

    list.innerHTML = strategies.map(s => `
        <div class="strategy-item" style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div style="font-weight: bold; font-size: 12px;">${s.name}</div>
            <div style="font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.prompt}</div>
        </div>
    `).join('');

    // Also update the Style Select?
    // Optional: Add captured strategies to the dropdown
    updateStyleDropdown(strategies);
}

function updateStyleDropdown(strategies) {
    const select = document.getElementById('defaultStyle');
    if (!select) return;

    // Remove old captured options (if any logic existed) - simplified: just append
    // Ideally we clear "custom-strategy" class options
    Array.from(select.options).forEach(opt => {
        if (opt.classList.contains('custom-strategy')) select.remove(opt.index);
    });

    strategies.forEach(s => {
        const option = document.createElement('option');
        option.value = `custom:${s.name}`; // Prefix to identify
        option.textContent = `Strategy: ${s.name}`;
        option.classList.add('custom-strategy');
        // Store prompt in dataset ?? No, logic needs to lookup
        select.appendChild(option);
    });
}

function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Toggle API key visibility
    const toggleKeyBtn = document.getElementById('toggleKey');
    if (toggleKeyBtn) {
        toggleKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    // Default style change
    const defaultStyleSelect = document.getElementById('defaultStyle');
    if (defaultStyleSelect) {
        defaultStyleSelect.addEventListener('change', (e) => {
            toggleCustomPrompt(e.target.value === 'custom');
        });
    }

    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    // IG Autonomous Mode
    const igAutoBtn = document.getElementById('igAutoStartBtn');
    if (igAutoBtn) {
        igAutoBtn.addEventListener('click', () => toggleAutoPilot('instagram'));
    }

    // Twitter Autonomous Mode
    const twAutoBtn = document.getElementById('twAutoStartBtn');
    if (twAutoBtn) {
        twAutoBtn.addEventListener('click', () => toggleAutoPilot('twitter'));
    }

    // Notion Actions
    const scrapeBtn = document.getElementById('scrapeNotionBtn');
    if (scrapeBtn) {
        scrapeBtn.addEventListener('click', scrapeNotion);
    }
    const pushBtn = document.getElementById('pushNotionBtn');
    if (pushBtn) {
        pushBtn.addEventListener('click', pushNotionReport);
    }
}

// --- Tab Logic ---
function switchTab(tabId) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = content.id === `${tabId}-tab` ? 'block' : 'none';
        content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    // Save state
    chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.lastTab = tabId;
        chrome.storage.local.set({ settings });
    });

    // Refresh platform status
    if (tabId === 'instagram') checkAutoStatus('instagram');
    if (tabId === 'twitter') checkAutoStatus('twitter');
    if (tabId === 'notion') checkNotionStatus();
}

// --- Helper Functions ---

function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleBtn = document.getElementById('toggleKey');

    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.textContent = 'Hide';
    } else {
        apiKeyInput.type = 'password';
        toggleBtn.textContent = 'Show';
    }
}

function toggleCustomPrompt(show) {
    const section = document.getElementById('customPromptSection');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

async function saveSettings() {
    const selectedModel = document.querySelector('input[name="provider"]:checked')?.value || 'deepseek-ai/DeepSeek-V3.1';
    const apiKey = document.getElementById('apiKey').value.trim();
    const defaultStyle = document.getElementById('defaultStyle').value;
    const customPrompt = document.getElementById('customPrompt').value.trim();

    if (!apiKey) {
        showStatus('Please enter your NEAR AI API key', 'error');
        return;
    }

    // Preserve existing settings like capturedStrategies
    const oldSettings = await new Promise(r => chrome.storage.local.get(['settings'], res => r(res.settings || {})));

    const settings = {
        ...oldSettings,
        selectedModel,
        apiKey,
        defaultStyle,
        instructions: document.getElementById('instructions').value.trim(),
        customPrompt,
        lastTab: document.querySelector('.tab-btn.active')?.dataset.tab || 'instagram'
    };

    await chrome.storage.local.set({ settings });
    showStatus('Settings saved', 'success');
}

// --- Notion Logic ---

function checkNotionStatus() {
    const statusBadge = document.getElementById('notionPageStatus');
    const titleEl = document.getElementById('notionPageTitle');
    const scrapeBtn = document.getElementById('scrapeNotionBtn');
    const pushBtn = document.getElementById('pushNotionBtn');

    if (!statusBadge) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || '';
        if (url.includes('notion.so')) {
            // Check if content script is alive
            chrome.tabs.sendMessage(tabs[0].id, { action: 'checkNotionPage' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    statusBadge.textContent = 'ERROR';
                    titleEl.textContent = 'Refresh page.';
                    return;
                }
                statusBadge.textContent = 'ACTIVE';
                statusBadge.classList.add('running'); // Reuse distinct style
                titleEl.textContent = response.title.length > 30 ? response.title.substring(0, 30) + '...' : response.title;

                scrapeBtn.disabled = false;
                pushBtn.disabled = false;
            });
        } else {
            statusBadge.textContent = 'NO PAGE';
            statusBadge.classList.remove('running');
            titleEl.textContent = 'Open Notion to capture/sync.';
            scrapeBtn.disabled = true;
            pushBtn.disabled = true;
        }
    });
}

function scrapeNotion() {
    showStatus('Scraping...', 'info');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeNotionStrategies' }, async (response) => {
            if (response && response.success) {
                const strategies = response.strategies;
                // Save to settings
                const settings = await new Promise(r => chrome.storage.local.get(['settings'], res => r(res.settings || {})));
                settings.capturedStrategies = strategies;
                await chrome.storage.local.set({ settings });

                renderStrategies(strategies);
                showStatus(`Captured ${strategies.length} strategies`, 'success');
            } else {
                showStatus('Failed to scrape. Is it a table?', 'error');
            }
        });
    });
}

async function pushNotionReport() {
    showStatus('Preparing report...', 'info');
    // Get Stats
    const stats = await new Promise(r => chrome.runtime.sendMessage({ action: 'getStats' }, res => r(res.stats || {})));

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'pushNotionReport', stats }, (response) => {
            if (response && response.success) {
                showStatus('Report pushed!', 'success');
            } else {
                showStatus(response?.message || 'Failed push', 'error');
            }
        });
    });
}


// --- Auto Pilot Logic (Generic) ---

function getElements(platform) {
    const prefix = platform === 'instagram' ? 'ig' : 'tw';
    return {
        btn: document.getElementById(`${prefix}AutoStartBtn`),
        limitInput: document.getElementById(`${prefix}PostLimit`),
        badge: document.getElementById(`${prefix}AutoStatusBadge`),
        progressCircle: document.getElementById(`${prefix}ProgressCircle`),
        progressText: document.getElementById(`${prefix}ProgressText`)
    };
}

async function toggleAutoPilot(platform) {
    const { btn, limitInput } = getElements(platform);

    const isStopping = btn.classList.contains('stop-mode');
    const isStarting = !isStopping;

    if (isStarting) await saveSettings(); // Save settings before start

    updateAutoUI(platform, isStarting, 0, parseInt(limitInput.value) || 20);

    const action = isStarting ? 'startAutoPilot' : 'stopAutoPilot';
    const limit = parseInt(limitInput.value) || 20;

    // Send to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
            showStatus('Error: No active tab', 'error');
            updateAutoUI(platform, isStopping); // Revert
            return;
        }

        // Check if tab matches platform
        const url = tabs[0].url || '';
        if (platform === 'instagram' && !url.includes('instagram.com')) {
            showStatus('Open Instagram first!', 'error');
            updateAutoUI(platform, isStopping); // Revert
            return;
        }
        if (platform === 'twitter' && !url.includes('x.com') && !url.includes('twitter.com')) {
            showStatus('Open X/Twitter first!', 'error');
            updateAutoUI(platform, isStopping); // Revert
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {
            action: action,
            limit: limit
        }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus('Refresh the page!', 'error');
                updateAutoUI(platform, isStopping);
            }
        });
    });
}

function checkAutoStatus(platform) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Validation per platform
        const url = tabs[0]?.url || '';
        if (platform === 'instagram' && !url.includes('instagram.com')) return;
        if (platform === 'twitter' && !url.includes('x.com') && !url.includes('twitter.com')) return;

        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getAutoStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Stale tab or page reloading, ignore
                    return;
                }
                if (response) {
                    const { limitInput } = getElements(platform);
                    if (response.limit && limitInput) limitInput.value = response.limit;
                    updateAutoUI(platform, response.isRunning, response.count || 0, response.limit || 20);
                }
            });
        }
    });
}

function updateAutoUI(platform, isRunning, count = 0, limit = 20) {
    const { btn, limitInput, badge, progressCircle, progressText } = getElements(platform);

    if (isRunning) {
        if (badge) {
            badge.textContent = 'RUNNING';
            badge.classList.add('running');
        }
        if (limitInput) limitInput.disabled = true;
        if (btn) {
            btn.textContent = 'STOP';
            btn.classList.add('stop-mode');
        }
    } else {
        if (badge) {
            badge.textContent = 'READY';
            badge.classList.remove('running');
        }
        if (limitInput) limitInput.disabled = false;
        if (btn) {
            btn.textContent = 'START';
            btn.classList.remove('stop-mode');
        }
    }

    if (progressCircle && progressText) {
        const percentage = Math.min((count / limit) * 360, 360);
        progressCircle.style.setProperty('--progress', `${percentage}deg`);
        progressText.textContent = `${count}/${limit}`;
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    setTimeout(() => { statusEl.className = 'status-message'; }, 3000);
}
