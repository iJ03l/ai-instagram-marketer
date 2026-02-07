import { CONFIG } from '../config.js';

// Crixen - Popup Script
// Using NEAR AI Cloud API

document.addEventListener('DOMContentLoaded', checkAuth);

// --- Auth & Init Flow ---

async function checkAuth() {
    const { token } = await new Promise(r => chrome.storage.local.get('token', r));
    if (token) {
        init(token);
    } else {
        showLoginUI();
    }
}

function showLoginUI() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('userControls').style.display = 'none';

    const btn = document.getElementById('openDashboardBtn');
    if (btn) {
        btn.onclick = () => {
            // Open the dashboard to trigger auth sync
            chrome.tabs.create({ url: 'https://www.crixen.xyz/dashboard' });
            window.close(); // Close popup
        };
    }
}

async function handleLogout() {
    // Clear all project-specific data on logout
    await chrome.storage.local.remove(['token', 'user', 'activeProjectId', 'localProjects', 'projectLimits', 'settings']);
    location.reload();
}

async function init(token) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userControls').style.display = 'flex';

    // Logout Listener
    document.getElementById('logoutBtn').onclick = handleLogout;

    // Load Data
    await loadSettings();
    await fetchProjects(token);

    setupEventListeners();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab) switchTab(activeTab);
}

async function fetchProjects(token) {
    try {
        // 1. Get Projects from API (includes tier-based limits)
        const res = await fetch(`${CONFIG.API_URL.replace('/ai/generate', '')}/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            let backendProjects = data.projects || [];
            const limits = data.limits || { maxProjects: 1 };

            // Store limits for use in UI
            await chrome.storage.local.set({ projectLimits: limits });

            // If no projects exist in backend, create default automatically
            if (backendProjects.length === 0) {
                try {
                    const createRes = await fetch(`${CONFIG.API_URL.replace('/ai/generate', '')}/projects`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: 'Project 1' })
                    });
                    if (createRes.ok) {
                        const newProject = await createRes.json();
                        backendProjects = [newProject];
                    }
                } catch (e) {
                    console.error('Auto-create failed', e);
                }
            }

            // Save to local storage for offline use / speed
            await chrome.storage.local.set({ localProjects: backendProjects });

            // Render projects with limits info
            renderProjectDropdown(backendProjects, token, limits);

            // Load settings from active project
            const { activeProjectId } = await new Promise(r => chrome.storage.local.get('activeProjectId', r));
            const activeProject = backendProjects.find(p => String(p.id) === String(activeProjectId)) || backendProjects[0];
            if (activeProject) {
                await loadProjectSettings(activeProject);
            }
        } else {
            console.warn('API fetch failed, falling back to local');
            const stored = await new Promise(r => chrome.storage.local.get(['localProjects', 'projectLimits'], r));
            renderProjectDropdown(stored.localProjects || [], token, stored.projectLimits || { maxProjects: 1 });
        }
    } catch (err) {
        console.error('Failed to load projects from API.', err);
        const stored = await new Promise(r => chrome.storage.local.get(['localProjects', 'projectLimits'], r));
        renderProjectDropdown(stored.localProjects || [], token, stored.projectLimits || { maxProjects: 1 });
    }
}

function renderProjectDropdown(projects, token, limits = { maxProjects: 1 }) {
    const select = document.getElementById('projectSelect');
    const input = document.getElementById('projectRenameInput');
    const editBtn = document.getElementById('editProjectBtn');
    const addBtn = document.getElementById('addProjectBtn');
    const countBadge = document.getElementById('projectCountBadge');

    select.innerHTML = '';

    // Update project count badge
    if (countBadge) {
        const maxDisplay = limits.maxProjects === Infinity ? '∞' : limits.maxProjects;
        countBadge.textContent = `${projects.length}/${maxDisplay}`;
    }

    if (projects.length === 0) {
        const opt = document.createElement('option');
        opt.text = "No Projects";
        select.appendChild(opt);
        return;
    }

    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });

    // Show/hide Add Project button based on tier limits
    const canAddMore = projects.length < limits.maxProjects;
    if (addBtn) {
        addBtn.style.display = canAddMore ? 'flex' : 'none';
        addBtn.title = canAddMore
            ? `Add Project (${projects.length}/${limits.maxProjects === Infinity ? '∞' : limits.maxProjects})`
            : `Project limit reached (${limits.maxProjects})`;
    }

    // Set active
    chrome.storage.local.get('activeProjectId', (res) => {
        const activeId = res.activeProjectId ? String(res.activeProjectId) : null;

        if (activeId && projects.find(p => String(p.id) === activeId)) {
            select.value = activeId;
        } else if (projects.length > 0) {
            select.value = projects[0].id;
            chrome.storage.local.set({ activeProjectId: projects[0].id });
        }
    });

    // Listeners - On project change, load that project's settings
    select.onchange = async (e) => {
        const newProjectId = e.target.value;
        await chrome.storage.local.set({ activeProjectId: newProjectId });

        // Find the project and load its brand voice + strategies
        const project = projects.find(p => String(p.id) === String(newProjectId));
        if (project) {
            await loadProjectSettings(project);
        }
    };

    // Add Project Logic - Uses inline input instead of prompt()
    if (addBtn) {
        addBtn.onclick = async () => {
            if (!token) {
                alert("Online required to add projects.");
                return;
            }

            // Switch to inline input mode for adding
            select.style.display = 'none';
            input.style.display = 'block';
            input.value = '';
            input.placeholder = `New project name...`;
            input.focus();

            const createProject = async () => {
                const projectName = input.value.trim();
                if (!projectName) {
                    // Cancelled - reset UI
                    input.style.display = 'none';
                    select.style.display = 'block';
                    input.placeholder = '';
                    return;
                }

                try {
                    const createRes = await fetch(`${CONFIG.API_URL.replace('/ai/generate', '')}/projects`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: projectName })
                    });

                    if (createRes.ok) {
                        const newProject = await createRes.json();
                        await chrome.storage.local.set({ activeProjectId: newProject.id });
                        fetchProjects(token);
                    } else {
                        const err = await createRes.json();
                        alert(err.error || 'Failed to create project');
                    }
                } catch (e) {
                    console.error('Add project error', e);
                    alert('Network error creating project.');
                }

                // Reset UI
                input.style.display = 'none';
                select.style.display = 'block';
                input.placeholder = '';
            };

            input.onblur = createProject;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                } else if (e.key === 'Escape') {
                    input.value = '';
                    input.blur();
                }
            };
        };
    }

    // Rename Logic (Now Syncs to Backend)
    editBtn.onclick = () => {
        if (!token) {
            alert("Online required to rename.");
            return;
        }

        const currentId = select.value;
        const currentName = select.options[select.selectedIndex].text;

        select.style.display = 'none';
        input.style.display = 'block';
        input.value = currentName;
        input.focus();

        const saveName = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    // API Update
                    const updateRes = await fetch(`${CONFIG.API_URL.replace('/ai/generate', '')}/projects/${currentId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: newName })
                    });

                    if (updateRes.ok) {
                        // Update Local State
                        const updated = await updateRes.json();
                        const stored = await new Promise(r => chrome.storage.local.get('localProjects', r));
                        const localProjs = stored.localProjects || [];

                        const idx = localProjs.findIndex(p => String(p.id) === String(currentId));
                        if (idx !== -1) {
                            localProjs[idx].name = updated.name;
                            await chrome.storage.local.set({ localProjects: localProjs });
                            fetchProjects(token);
                        }
                    } else {
                        alert("Rename failed on server.");
                    }
                } catch (e) {
                    console.error("Rename error", e);
                    alert("Network error updating name.");
                }
            }
            // Reset UI
            input.style.display = 'none';
            select.style.display = 'block';
        };

        input.onblur = saveName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };
    };
}

// Load brand voice and strategies from a project into local settings
async function loadProjectSettings(project) {
    let fullProject = project;

    // Check if data is masked (NOVA Secured) - If so, fetch full details which are decrypted by API
    if (project.brand_voice === '**SECURED ON NOVA**' ||
        (project.strategies && project.strategies.length > 0 && Object.keys(project.strategies[0]).length === 0)) {
        console.log('[Crixen] Detected masked data, fetching decrypted details for:', project.name);
        try {
            const { token } = await new Promise(r => chrome.storage.local.get('token', r));
            if (token) {
                const res = await fetch(`${CONFIG.API_URL.replace('/ai/generate', '')}/projects/${project.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    fullProject = await res.json();

                    // Optional: Update local cache with this fresh data so we don't refetch on every dropdown change?
                    // For now, simpler is better. We trust the browser cache or network speed.
                } else {
                    console.warn('Failed to fetch project details:', res.status);
                }
            }
        } catch (e) {
            console.error('Failed to fetch unmasked project details', e);
        }
    }

    const oldSettings = await new Promise(r => chrome.storage.local.get(['settings'], res => r(res.settings || {})));

    const newSettings = {
        ...oldSettings,
        instructions: fullProject.brand_voice || '',
        capturedStrategies: fullProject.strategies || []
    };

    await chrome.storage.local.set({ settings: newSettings });

    // Update Brand Voice UI
    const instructionEl = document.getElementById('instructions');
    if (instructionEl) instructionEl.value = newSettings.instructions;

    const voiceDisplay = document.getElementById('voiceDisplay');
    if (voiceDisplay) voiceDisplay.textContent = newSettings.instructions || 'No brand voice defined.';



    // Update strategies display if visible
    const strategiesCount = document.getElementById('strategiesCount');
    if (strategiesCount) {
        strategiesCount.textContent = (newSettings.capturedStrategies || []).length;
    }

    console.log('[Crixen] Loaded project settings:', project.name);
}

// Old Init removed (replaced by above)
// async function init() { ... }


async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {
                selectedModel: 'deepseek-ai/DeepSeek-V3.1',
                apiKey: '',
                defaultStyle: 'friendly',
                customPrompt: '',
                lastTab: 'instagram',
                capturedStrategies: []
            };

            // Set model in dropdown
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = settings.selectedModel || 'deepseek-ai/DeepSeek-V3.1';
            }

            // Set default style
            document.getElementById('defaultStyle').value = settings.defaultStyle || 'friendly';

            // Set instructions / Brand Voice (hidden input for saving)
            const instructionEl = document.getElementById('instructions');
            const instructions = settings.instructions || '';
            if (instructionEl) instructionEl.value = instructions;

            // Update read-only display
            const voiceDisplay = document.getElementById('voiceDisplay');
            if (voiceDisplay) {
                voiceDisplay.textContent = instructions || 'No brand voice defined. Edit on Dashboard.';
            }

            // Show/hide custom prompt
            toggleCustomPrompt(settings.defaultStyle === 'custom');
            if (settings.customPrompt) {
                document.getElementById('customPrompt').value = settings.customPrompt;
            }

            // Render captured strategies
            renderStrategies(settings.capturedStrategies || []);

            // Update strategies count
            const strategiesCount = document.getElementById('strategiesCount');
            if (strategiesCount) {
                strategiesCount.textContent = (settings.capturedStrategies || []).length;
            }

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

    // Brand Voice - Link to Dashboard (read-only in extension)
    const editVoiceLink = document.getElementById('editVoiceOnDashboard');
    if (editVoiceLink) {
        editVoiceLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://www.crixen.xyz/dashboard/strategy' });
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

    // Notion Actions - Removed (Handled in-page)

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
    if (tabId === 'notion') {
        // No status check needed anymore
    }
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
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;

    // Show saving state
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    saveBtn.classList.add('saving');

    const selectedModel = document.getElementById('modelSelect')?.value || 'deepseek-ai/DeepSeek-V3.1';
    const defaultStyle = document.getElementById('defaultStyle').value;
    const customPrompt = document.getElementById('customPrompt').value.trim();
    const instructions = document.getElementById('instructions').value.trim();

    // Preserve existing settings like capturedStrategies
    const oldSettings = await new Promise(r => chrome.storage.local.get(['settings'], res => r(res.settings || {})));

    const settings = {
        ...oldSettings,
        selectedModel,
        apiKey: '',
        defaultStyle,
        instructions,
        customPrompt,
        lastTab: document.querySelector('.tab-btn.active')?.dataset.tab || 'instagram'
    };

    await chrome.storage.local.set({ settings });

    // Sync to backend (brand voice is read-only in extension, so we don't sync it here)
    const { token, activeProjectId } = await new Promise(r =>
        chrome.storage.local.get(['token', 'activeProjectId'], r)
    );

    let syncStatus = 'local';
    if (token && activeProjectId) {
        try {
            // Only sync model/style preferences (brand voice is edited on dashboard)
            syncStatus = 'synced';
        } catch (e) {
            console.error('Sync error:', e);
            syncStatus = 'offline';
        }
    }

    // Show success feedback with animation
    saveBtn.textContent = '✓ Saved!';
    saveBtn.classList.remove('saving');
    saveBtn.classList.add('saved');

    // Show notable status message
    showSaveSuccess(syncStatus);

    // Reset button after delay
    setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        saveBtn.classList.remove('saved');
    }, 2000);
}

function showSaveSuccess(syncStatus) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;

    const messages = {
        synced: '✓ Settings saved successfully',
        local: '✓ Settings saved locally',
        offline: '✓ Saved (offline mode)'
    };

    statusEl.textContent = messages[syncStatus] || messages.local;
    statusEl.className = 'status-message success visible';
    statusEl.style.display = 'block';

    // Animate in
    setTimeout(() => statusEl.classList.add('show'), 10);

    // Hide after delay
    setTimeout(() => {
        statusEl.classList.remove('show');
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 300);
    }, 3000);
}

// Notion Logic removed (Moved to Content Script buttons)



// --- Auto Pilot Logic (Generic) ---

function getElements(platform) {
    const prefix = platform === 'instagram' ? 'ig' : 'tw';
    return {
        btn: document.getElementById(`${prefix}AutoStartBtn`),
        limitInput: document.getElementById(`${prefix}PostLimit`),
        badge: document.getElementById(`${prefix}AutoStatusBadge`),
        statusText: document.getElementById(`${prefix}AutoStatusText`)
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
    const { btn, limitInput, badge, statusText } = getElements(platform);

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
        if (statusText) {
            statusText.textContent = `Progress: ${count} / ${limit} Posted`;
            statusText.style.color = '#10b981'; // Green
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
        if (statusText) {
            statusText.textContent = ''; // Clear text when not running
        }
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    setTimeout(() => { statusEl.className = 'status-message'; }, 3000);
}
