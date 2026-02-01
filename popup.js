// Instagram AI Comment Assistant - Popup Script
// Using NEAR AI Cloud API

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadSettings();
    await loadStats();
    setupEventListeners();
}

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {
                selectedModel: 'deepseek',
                apiKey: '',
                defaultStyle: 'friendly',
                customPrompt: '',
                instructions: ''
            };

            // Set provider/model
            const modelRadio = document.querySelector(`input[value="${settings.selectedModel}"]`);
            if (modelRadio) {
                modelRadio.checked = true;
            } else {
                // Default fallback
                const fallback = document.querySelector('input[value="deepseek"]');
                if (fallback) fallback.checked = true;
            }

            // Set API key
            document.getElementById('apiKey').value = settings.apiKey || '';

            // Set default style
            document.getElementById('defaultStyle').value = settings.defaultStyle || 'friendly';

            // Set instructions
            document.getElementById('instructions').value = settings.instructions || '';

            // Show/hide custom prompt
            toggleCustomPrompt(settings.defaultStyle === 'custom');
            if (settings.customPrompt) {
                document.getElementById('customPrompt').value = settings.customPrompt;
            }

            resolve();
        });
    });
}

async function loadStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { generated: 0, posted: 0 };

            document.getElementById('totalGenerated').textContent = stats.generated || 0;
            document.getElementById('totalPosted').textContent = stats.posted || 0;

            resolve();
        });
    });
}

function setupEventListeners() {
    // Toggle API key visibility
    document.getElementById('toggleKey').addEventListener('click', toggleApiKeyVisibility);

    // Default style change
    document.getElementById('defaultStyle').addEventListener('change', (e) => {
        toggleCustomPrompt(e.target.value === 'custom');
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveSettings);

    // Test button
    document.getElementById('testBtn').addEventListener('click', testConnection);

    // Reset stats
    document.getElementById('resetStats').addEventListener('click', resetStats);

    // Autonomous Mode
    document.getElementById('autoToggleBtn').addEventListener('click', toggleAutoPilot);
}

function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleBtn = document.getElementById('toggleKey');

    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

function toggleCustomPrompt(show) {
    const section = document.getElementById('customPromptSection');
    section.style.display = show ? 'block' : 'none';
}

async function saveSettings() {
    const selectedModel = document.querySelector('input[name="provider"]:checked')?.value || 'deepseek';
    const apiKey = document.getElementById('apiKey').value.trim();
    const defaultStyle = document.getElementById('defaultStyle').value;
    const instructions = document.getElementById('instructions').value.trim();
    const customPrompt = document.getElementById('customPrompt').value.trim();

    // Save Auto Settings too
    const postLimit = parseInt(document.getElementById('postLimit').value) || 20;

    if (!apiKey) {
        showStatus('Please enter your NEAR AI API key', 'error');
        return;
    }

    const settings = {
        selectedModel: selectedModel,
        apiKey: apiKey,
        defaultStyle: defaultStyle,
        instructions: instructions,
        customPrompt: customPrompt,
        postLimit: postLimit
    };

    await chrome.storage.local.set({ settings });

    showStatus('✅ Settings saved!', 'success');
}

async function toggleAutoPilot() {
    const btn = document.getElementById('autoToggleBtn');
    const statusEl = document.getElementById('autoStatus');
    const limitInput = document.getElementById('postLimit');

    const isRunning = btn.classList.contains('stop');
    const action = isRunning ? 'stopAutoPilot' : 'startAutoPilot';

    // Save settings first if starting
    if (!isRunning) await saveSettings();

    const limit = parseInt(limitInput.value) || 20;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
            showStatus('Detailed error: No active tab found', 'error');
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {
            action: action,
            limit: limit
        }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus('Refresh the page first!', 'error');
                return;
            }

            if (response && response.success) {
                if (!isRunning) {
                    btn.textContent = 'Stop Auto-Pilot';
                    btn.classList.add('stop');
                    statusEl.textContent = 'RUNNING';
                    statusEl.classList.add('running');
                    limitInput.disabled = true;
                } else {
                    btn.textContent = 'Start Auto-Pilot';
                    btn.classList.remove('stop');
                    statusEl.textContent = 'Stopped';
                    statusEl.classList.remove('running');
                    limitInput.disabled = false;
                }
            }
        });
    });
}

// Check status on load
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getAutoStatus' }, (response) => {
            if (response && response.isRunning) {
                const btn = document.getElementById('autoToggleBtn');
                const statusEl = document.getElementById('autoStatus');
                const limitInput = document.getElementById('postLimit');

                btn.textContent = 'Stop Auto-Pilot';
                btn.classList.add('stop');
                statusEl.textContent = 'RUNNING';
                statusEl.classList.add('running');
                limitInput.disabled = true;
                if (response.limit) limitInput.value = response.limit;
            }
        });
    }
});

async function testConnection() {
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!apiKey) {
        showStatus('Please enter an API key first', 'error');
        return;
    }

    showStatus('Testing connection...', 'info');

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'testConnection',
            apiKey: apiKey
        });

        if (response.success) {
            showStatus('✅ Connection successful!', 'success');
        } else {
            showStatus('❌ ' + (response.error || 'Connection failed'), 'error');
        }
    } catch (error) {
        showStatus('❌ ' + error.message, 'error');
    }
}

async function resetStats() {
    if (!confirm('Reset all statistics?')) return;

    await chrome.storage.local.set({
        stats: {
            generated: 0,
            posted: 0,
            byStyle: {}
        }
    });

    document.getElementById('totalGenerated').textContent = '0';
    document.getElementById('totalPosted').textContent = '0';

    showStatus('Statistics reset!', 'success');
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 3000);
}

