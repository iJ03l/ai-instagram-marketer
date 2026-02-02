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
        // Target the top bar action area
        const topbar = document.querySelector('.notion-topbar');
        if (!topbar) return;

        const actionsContainer = topbar.querySelector('div[style*="display: flex"] > div:last-child')
            || topbar.lastElementChild;

        if (!actionsContainer) return;

        // Check if our container already exists
        if (document.getElementById('smith-ai-controls')) return;

        // Determine Context
        const context = analyzeContext();

        if (context.type === 'none') return;

        // Create Container with glassmorphism
        const container = document.createElement('div');
        container.id = 'smith-ai-controls';
        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginRight: '12px',
            padding: '6px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
        });

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
            }, '🎨', 'primary'));

        } else if (context.type === 'empty') {
            // Strategy Button (Primary)
            container.appendChild(createButton('Strategy', async () => {
                await generateAndInsertContent('generateStrategyDoc', 'Strategy');
            }, '✨', 'primary'));

            // Toolkit Buttons
            container.appendChild(createButton('Calendar', () =>
                generateAndInsertContent('generateToolkit', 'Content Calendar', 'calendar'),
                '📅', 'secondary'));

            container.appendChild(createButton('Audit', () =>
                generateAndInsertContent('generateToolkit', 'Competitor Audit', 'audit'),
                '🔍', 'secondary'));

            container.appendChild(createButton('Influencer', () =>
                generateAndInsertContent('generateToolkit', 'Influencer Tracker', 'influencer'),
                '🤝', 'secondary'));

        } else {
            // Report context
            container.appendChild(createButton('Push Report', async () => {
                showToast('Fetching stats...', 'info');
                const response = await chrome.runtime.sendMessage({ action: 'getStats' });
                const stats = response.stats || {};
                const result = await pushReport(stats);
                showToast(result.message || 'Done', result.success ? 'success' : 'error');
            }, '📊', 'primary'));
        }

        // Insert into DOM
        actionsContainer.prepend(container);
    }

    // ✅ FIXED: Unified content generation and insertion
    async function generateAndInsertContent(action, displayName, toolType = null) {
        showToast(`Generating ${displayName}... (30s)`, 'info');

        try {
            const message = toolType
                ? { action, toolType }
                : { action };

            const res = await chrome.runtime.sendMessage(message);

            if (res && res.success && res.doc) {
                console.log('[SMITH] Received content:', res.doc.substring(0, 100));

                // ✅ IMPROVED: Better Notion content insertion
                const success = await insertContentIntoNotion(res.doc);

                if (success) {
                    showToast(`${displayName} Created!`, 'success');
                } else {
                    showToast('Error: Could not insert content', 'error');
                }
            } else {
                showToast('Generation failed: ' + (res?.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            console.error('[SMITH] Generation error:', e);
            showToast('Error: ' + e.message, 'error');
        }
    }

    // ✅ COMPLETELY REWRITTEN: Notion content insertion
    async function insertContentIntoNotion(markdownContent) {
        console.log('[SMITH] Inserting content into Notion...');

        // Method 1: Try to find the main content editable area
        let target = document.querySelector('.notion-page-content [contenteditable="true"]');

        // Method 2: Try the placeholder area
        if (!target) {
            target = document.querySelector('[data-content-editable-leaf="true"]');
        }

        // Method 3: Try any contenteditable in the main area
        if (!target) {
            target = document.querySelector('.notion-page-block-children [contenteditable="true"]');
        }

        if (!target) {
            console.error('[SMITH] No editable area found');
            return false;
        }

        console.log('[SMITH] Found target:', target);

        // Focus and wait
        target.click();
        target.focus();
        await sleep(300);

        // ✅ Try multiple insertion methods
        let success = false;

        // Method 1: execCommand (most reliable for Notion)
        if (document.execCommand) {
            try {
                // Clear existing content first
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);

                // Insert new content
                success = document.execCommand('insertText', false, markdownContent);
                console.log('[SMITH] execCommand result:', success);
            } catch (e) {
                console.error('[SMITH] execCommand failed:', e);
            }
        }

        // Method 2: Paste event (fallback)
        if (!success) {
            try {
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: new DataTransfer()
                });

                pasteEvent.clipboardData.setData('text/plain', markdownContent);
                target.dispatchEvent(pasteEvent);

                success = true;
                console.log('[SMITH] Paste event dispatched');
            } catch (e) {
                console.error('[SMITH] Paste event failed:', e);
            }
        }

        // Method 3: Direct manipulation (last resort)
        if (!success) {
            try {
                target.innerText = markdownContent;

                // Trigger input events
                target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true }));
                target.dispatchEvent(new InputEvent('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                success = true;
                console.log('[SMITH] Direct manipulation completed');
            } catch (e) {
                console.error('[SMITH] Direct manipulation failed:', e);
            }
        }

        // Give Notion time to process
        await sleep(500);

        return success;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function analyzeContext() {
        // 1. Table Database
        const rows = document.querySelectorAll('.notion-table-view .notion-table-row');
        if (rows.length > 0) return { type: 'table' };

        // 2. Empty Page
        const pageContent = document.querySelector('.notion-page-content');
        if (pageContent) {
            const blocks = pageContent.querySelectorAll('[data-block-id]');
            if (blocks.length < 3) return { type: 'empty' };
            return { type: 'page' };
        }

        return { type: 'none' };
    }

    // ✅ REDESIGNED: Glassmorphism buttons
    function createButton(text, onClick, icon, variant = 'secondary') {
        const btn = document.createElement('div');
        btn.role = 'button';
        btn.className = 'smith-notion-btn';
        btn.innerHTML = `<span style="font-size: 16px; margin-right: 6px;">${icon}</span><span>${text}</span>`;

        // Glassmorphism base styles
        const baseStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '32px',
            padding: '0 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            whiteSpace: 'nowrap',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.3px'
        };

        if (variant === 'primary') {
            // Primary button - Black Glass
            Object.assign(btn.style, {
                ...baseStyles,
                background: 'rgba(20, 20, 20, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            });

            btn.onmouseenter = () => {
                btn.style.transform = 'translateY(-2px) scale(1.02)';
                btn.style.background = 'rgba(0, 0, 0, 0.95)';
                btn.style.boxShadow = '0 8px 25px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            };

            btn.onmouseleave = () => {
                btn.style.transform = 'translateY(0) scale(1)';
                btn.style.background = 'rgba(20, 20, 20, 0.85)';
                btn.style.boxShadow = '0 4px 16px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            };

        } else {
            // Secondary button - Lighter Black Glass
            Object.assign(btn.style, {
                ...baseStyles,
                background: 'rgba(40, 40, 40, 0.7)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#e0e0e0',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            });

            btn.onmouseenter = () => {
                btn.style.background = 'rgba(30, 30, 30, 0.8)';
                btn.style.transform = 'translateY(-1px)';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            };

            btn.onmouseleave = () => {
                btn.style.background = 'rgba(40, 40, 40, 0.7)';
                btn.style.transform = 'translateY(0)';
                btn.style.color = '#e0e0e0';
                btn.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
            };
        }

        // Active state
        btn.onmousedown = () => {
            btn.style.transform = 'scale(0.96)';
        };

        btn.onmouseup = () => {
            btn.style.transform = variant === 'primary' ? 'translateY(-2px) scale(1.02)' : 'translateY(-1px)';
        };

        btn.onclick = (e) => {
            e.stopPropagation();

            // Ripple effect
            const ripple = document.createElement('span');
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            Object.assign(ripple.style, {
                position: 'absolute',
                width: size + 'px',
                height: size + 'px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                left: x + 'px',
                top: y + 'px',
                transform: 'scale(0)',
                animation: 'ripple 0.6s ease-out',
                pointerEvents: 'none'
            });

            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);

            onClick();
        };

        // Add ripple animation
        if (!document.getElementById('smith-ripple-animation')) {
            const style = document.createElement('style');
            style.id = 'smith-ripple-animation';
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        return btn;
    }

    // --- Shared Logic ---

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
            await sleep(1000);

            const titleInput = document.querySelector('div.notion-page-content-placeholder + div [contenteditable="true"]') ||
                document.querySelector('.notion-overlay-container [contenteditable="true"]');

            if (titleInput) {
                await insertContentIntoNotion.call({ target: titleInput }, `Report: ${new Date().toLocaleDateString()}`);
            }
        }

        const reportText = `
DAILY REPORT - ${new Date().toLocaleTimeString()}
-------------------------
Generated: ${stats.generated || 0}
Posted:    ${stats.posted || 0}
-------------------------
By Style:
${Object.entries(stats.byStyle || {}).map(([style, count]) => `  ${style}: ${count}`).join('\n')}
`;

        const success = await insertContentIntoNotion(reportText);

        return {
            success,
            message: success ? 'Report created!' : 'Could not insert report'
        };
    }

    // ✅ IMPROVED: Toast notifications with glassmorphism
    function showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.smith-toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'smith-toast';
        toast.innerText = message;

        const colors = {
            success: { bg: 'rgba(16, 185, 129, 0.95)', border: 'rgba(16, 185, 129, 0.5)' },
            error: { bg: 'rgba(239, 68, 68, 0.95)', border: 'rgba(239, 68, 68, 0.5)' },
            info: { bg: 'rgba(59, 130, 246, 0.95)', border: 'rgba(59, 130, 246, 0.5)' }
        };

        const color = colors[type] || colors.info;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            background: color.bg,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'white',
            border: `1px solid ${color.border}`,
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            zIndex: '10000',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            animation: 'slideInUp 0.3s ease-out',
            letterSpacing: '0.3px'
        });

        // Add slide-in animation
        if (!document.getElementById('smith-toast-animation')) {
            const style = document.createElement('style');
            style.id = 'smith-toast-animation';
            style.textContent = `
                @keyframes slideInUp {
                    from {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInUp 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Message Listener
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

    console.log('SMITH ai: Fully initialized with glassmorphism UI');

})();