// SMITH ai - Notion Integration (Native UI Injection)

(function () {
    'use strict';

    console.log('SMITH ai: Notion Native Script Loaded');

    // Wait for Notion to load and observe changes
    const observer = new MutationObserver(() => {
        handleInjection();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Debounce injection to avoid performance hits
    let debounceTimeout;
    function handleInjection() {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(addCustomButtons, 500);
    }

    function addCustomButtons() {
        // Target the top bar action area (where Share / Favorites are)
        // Notion selectors are tricky. Common reliable ones:
        // .notion-topbar-action-buttons
        // .notion-topbar-share-menu

        // We will try to find the standard topbar container
        const topbar = document.querySelector('.notion-topbar');
        if (!topbar) return;

        // Try to insert before the "Share" button or at the start of the right-side actions
        // Usually the right side actions are in a flex container inside topbar
        const actionsContainer = topbar.querySelector('div[style*="display: flex"] > div:last-child')
            || topbar.lastElementChild;

        if (!actionsContainer) return;

        // Check if our container already exists
        if (document.getElementById('smith-ai-controls')) return;

        // Determine Context
        const context = analyzeContext();

        if (context.type === 'none') return;

        // Create Container
        const container = document.createElement('div');
        container.id = 'smith-ai-controls';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginRight = '12px';
        container.style.gap = '8px';

        // Add Context-Specific Buttons
        if (context.type === 'table') {
            container.appendChild(createButton('Capture Strategies', async () => {
                const strategies = scrapeStrategies();
                if (strategies.length > 0) {
                    await chrome.runtime.sendMessage({ action: 'saveStrategies', strategies });
                    showToast(`Captured ${strategies.length} strategies!`, 'success');
                } else {
                    showToast('No valid rows found (Need Name & Prompt)', 'error');
                }
            }, '🎨'));
        } else if (context.type === 'empty') {
            container.appendChild(createButton('Create Strategy', async () => {
                showToast('Generating Strategy... (This may take 30s)', 'info');
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'generateStrategyDoc' });
                    if (res && res.success && res.doc) {
                        const bodyBlock = document.querySelector('.notion-page-content [data-content-editable-leaf="true"]');
                        if (bodyBlock) {
                            simulateTyping(bodyBlock, res.doc);
                        }
                        showToast('Strategy Created!', 'success');
                    } else {
                        showToast('Generation failed', 'error');
                    }
                } catch (e) {
                    showToast('Error: ' + e.message, 'error');
                }
            }, '✨'));
        } else {
            // Default / Report context
            container.appendChild(createButton('Push Report', async () => {
                showToast('Fetching stats...', 'info');
                const response = await chrome.runtime.sendMessage({ action: 'getStats' });
                const stats = response.stats || {};

                const result = await pushReport(stats);
                showToast(result.message || 'Done', result.success ? 'success' : 'error');
            }, '📊'));
        }

        // Insert into DOM
        // We prepend to the actions container so it's visible before the system buttons
        actionsContainer.prepend(container);
    }

    function analyzeContext() {
        // 1. Table Database
        const rows = document.querySelectorAll('.notion-table-view .notion-table-row');
        if (rows.length > 0) return { type: 'table' };

        // 2. Empty Page
        const pageContent = document.querySelector('.notion-page-content');
        if (pageContent) {
            const blocks = pageContent.querySelectorAll('[data-block-id]');
            // Heuristic for "Empty": Less than 3 blocks (Title + 1 empty block)
            if (blocks.length < 3) return { type: 'empty' };
            return { type: 'page' };
        }

        return { type: 'none' };
    }

    function createButton(text, onClick, icon) {
        const btn = document.createElement('div');
        btn.role = 'button';
        btn.className = 'smith-notion-btn';
        btn.innerHTML = `${icon} <span style="margin-left:4px">${text}</span>`;

        // Match Notion's button style (approx)
        Object.assign(btn.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            padding: '0 8px',
            borderRadius: '4px',
            background: 'rgba(55, 53, 47, 0.08)',
            color: '#37352f',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.1s ease',
            whiteSpace: 'nowrap'
        });

        btn.onmouseenter = () => btn.style.background = 'rgba(55, 53, 47, 0.16)';
        btn.onmouseleave = () => btn.style.background = 'rgba(55, 53, 47, 0.08)';

        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };

        return btn;
    }

    async function runToolkitGen(action, type) {
        showToast('Generating... (Please wait)', 'info');
        try {
            const res = await chrome.runtime.sendMessage({ action, toolType: type });
            if (res && res.success && res.doc) {
                const bodyBlock = document.querySelector('.notion-page-content [data-content-editable-leaf="true"]');
                if (bodyBlock) {
                    simulateTyping(bodyBlock, res.doc);
                }
                showToast('Content Created!', 'success');
            } else {
                showToast('Generation failed', 'error');
            }
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    }

    // --- Shared Logic (Preserved) ---

    function scrapeStrategies() {
        const rows = document.querySelectorAll('.notion-table-view .notion-table-row');
        const strategies = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('[data-content-editable-leaf="true"]');
            if (cells.length >= 2) {
                const name = cells[0].innerText.trim();
                const prompt = cells[1].innerText.trim();
                if (name && prompt) strategies.push({ name, prompt });
            }
        });
        return strategies;
    }

    async function pushReport(stats) {
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        const newBtn = buttons.find(b => b.innerText === 'New');

        if (newBtn) {
            newBtn.click();
            await new Promise(r => setTimeout(r, 1000));
            const titleInput = document.querySelector('div.notion-page-content-placeholder + div [contenteditable="true"]') ||
                document.querySelector('.notion-overlay-container [contenteditable="true"]');
            if (titleInput) simulateTyping(titleInput, `Report: ${new Date().toLocaleDateString()}`);
        }

        const bodyBlock = document.querySelector('.notion-page-content [data-content-editable-leaf="true"]');
        if (bodyBlock) {
            bodyBlock.click();
            await new Promise(r => setTimeout(r, 500));

            const reportText = `
DAILY REPORT - ${new Date().toLocaleTimeString()}
-------------------------
Generated: ${stats.generated || 0}
Posted:    ${stats.posted || 0}
-------------------------
`;
            simulateTyping(document.activeElement || bodyBlock, reportText);
            return { success: true, message: 'Report typed into page.' };
        }
        return { success: false, message: 'Could not find writable area.' };
    }

    function simulateTyping(element, text) {
        element.focus();
        element.innerText = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.innerText = message;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            background: type === 'error' ? 'white' : 'black',
            color: type === 'error' ? 'black' : 'white',
            border: '1px solid white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            zIndex: '10000',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            fontFamily: 'sans-serif'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Keep Listener for Popup Interaction
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeNotionStrategies') {
            sendResponse({ success: true, strategies: scrapeStrategies() });
        } else if (request.action === 'pushNotionReport') {
            pushReport(request.stats).then(result => sendResponse(result));
            return true;
        } else if (request.action === 'checkNotionPage') {
            sendResponse({ isNotion: true, title: document.title });
        }
    });

})();
