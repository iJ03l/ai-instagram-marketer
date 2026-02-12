// Crixen - Notion Integration (Native UI Injection)

(function () {
    'use strict';

    const Logger = window.CrixenLogger || console;

    Logger.info('Crixen: Notion Native Script Loaded');

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

    // Icons
    const ICONS = {
        strategy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        calendar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        audit: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        influencer: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        capture: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        report: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
    };

    function addCustomButtons() {
        // Target the top bar action area
        const topbar = document.querySelector('.notion-topbar');
        if (!topbar) return;

        const actionsContainer = topbar.querySelector('div[style*="display: flex"] > div:last-child')
            || topbar.lastElementChild;

        if (!actionsContainer) return;

        // Check if our container already exists
        if (document.getElementById('crixen-ai-controls')) return;

        // Determine Context
        const context = analyzeContext();

        if (context.type === 'none') return;

        // Create Container - Minimal (No Glassmorphism)
        const container = document.createElement('div');
        container.id = 'crixen-ai-controls';
        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginRight: '12px',
        });

        // Add Context-Specific Buttons
        // Unified: All tools available on all pages

        // 1. Strategy Button
        container.appendChild(createButton('Strategy', async () => {
            const questions = [
                { id: 'brandName', label: 'Brand/Business Name', type: 'text', required: true },
                { id: 'industry', label: 'Industry/Niche', type: 'text', required: true },
                { id: 'audience_mission', label: 'Target Audience, Mission', type: 'textarea', required: true },
                { id: 'brandVoice', label: 'Brand Voice/Tone', type: 'text' },
                { id: 'usp', label: 'Unique Selling Point', type: 'textarea' }
            ];
            const answers = await createInputModal('Brand Strategy Builder', questions, ICONS.strategy);
            if (answers) await generateAndInsertContent('generateStrategyDoc', 'Strategy', null, true, answers);
        }, ICONS.strategy, 'secondary', 'Generate a full brand strategy document'));

        // 2. Calendar Tool
        container.appendChild(createButton('Calendar', async () => {
            const questions = [
                { id: 'brandName', label: 'Brand/Business Name', type: 'text', required: true },
                { id: 'description', label: 'Description', type: 'textarea' },
                { id: 'industry', label: 'Industry', type: 'text', required: true },
                { id: 'frequency', label: 'Posts per Week', type: 'select', options: ['3', '5', '7', '10+'], required: true }
            ];
            const answers = await createInputModal('Content Calendar Setup', questions, ICONS.calendar);
            if (answers) await generateAndInsertContent('generateToolkit', 'Content Calendar', 'calendar', true, answers);
        }, ICONS.calendar, 'secondary', 'Create a social media content calendar'));

        // 3. Audit Tool
        container.appendChild(createButton('Audit', async () => {
            const questions = [
                { id: 'brandName', label: 'Your Brand Name', type: 'text', required: true },
                { id: 'industry', label: 'Industry', type: 'text', required: true },
                { id: 'description', label: 'Description', type: 'textarea' },
                { id: 'analyze_what', label: 'What to analyze?', type: 'multiselect', options: ['Content Strategy', 'Engagement', 'Visuals', 'Hashtags', 'Competitors'], required: true },
                { id: 'strength', label: 'Your Current Strength', type: 'text' }
            ];
            const answers = await createInputModal('Competitor Audit Setup', questions, ICONS.audit);
            if (answers) await generateAndInsertContent('generateToolkit', 'Competitor Audit', 'audit', true, answers);
        }, ICONS.audit, 'secondary', 'Generate a competitor analysis report'));

        // 4. Influencer Tool
        container.appendChild(createButton('Influencer', async () => {
            const questions = [
                { id: 'goal', label: 'Campaign Goal', type: 'select', options: ['Brand Awareness', 'Sales/Conversions', 'UGC Creation', 'Event Promotion'], required: true },
                { id: 'industry', label: 'Industry/Niche', type: 'text', required: true },
                { id: 'budget', label: 'Budget Range', type: 'select', options: ['$0-$500', '$500-$2000', '$2000-$10k', '$10k+'], required: true },
                { id: 'platforms', label: 'Target Platforms', type: 'multiselect', options: ['Instagram', 'TikTok', 'YouTube', 'X/Twitter', 'LinkedIn'], required: true },
                { id: 'deliverables', label: 'Expected Deliverables', type: 'textarea' },
                { id: 'timeline', label: 'Campaign Timeline', type: 'text' }
            ];
            const answers = await createInputModal('Influencer Campaign Setup', questions, ICONS.influencer);
            if (answers) await generateAndInsertContent('generateToolkit', 'Influencer Tracker', 'influencer', true, answers);
        }, ICONS.influencer, 'secondary', 'Create an influencer tracking database'));

        // 5. Capture Button (Primary)
        container.appendChild(createButton('Capture', async () => {
            const strategies = await scrapeStrategies();
            if (strategies.length > 0) {
                await chrome.runtime.sendMessage({ action: 'saveStrategies', strategies });
                showToast(`Captured ${strategies.length} strategies!`, 'success');
            } else {
                showToast('No structured data found (Need Name & Prompt)', 'error');
            }
        }, ICONS.capture, 'primary', 'Capture strategies from selection or page'));

        // 6. Report Button
        container.appendChild(createButton('Report', async () => {
            showToast('Fetching stats...', 'info');
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getStats' });

                if (response?.error === 'AUTH_REQUIRED') {
                    showAuthPrompt();
                    return;
                }

                const stats = response.stats || {};
                const result = await pushReport(stats);

                showToast(result.message || 'Done', result.success ? 'success' : 'error');
            } catch (e) {
                if (e.message.includes('validat') || e.message.includes('context')) {
                    showToast('Extension updated: Please REFRESH page!', 'error');
                } else {
                    showToast('Error: ' + e.message, 'error');
                }
            }
        }, ICONS.report, 'secondary', 'Append daily stats to this page'));

        // Insert into DOM
        actionsContainer.prepend(container);
    }

    // ✅ FIXED: Unified content generation and insertion
    async function generateAndInsertContent(action, displayName, toolType = null, clearPage = false, additionalContext = null) {
        showToast(`Generating ${displayName}... (Wait ~30s)`, 'info');

        try {
            const message = { action, additionalContext };
            if (toolType) message.toolType = toolType;

            Logger.info('[CRIXEN] Sending message to background:', JSON.stringify(message));
            const res = await chrome.runtime.sendMessage(message);
            Logger.info('[CRIXEN] Response from background:', JSON.stringify(res));

            if (res && res.success && res.doc) {
                Logger.info('[CRIXEN] Received content length:', res.doc.length);
                Logger.info('[CRIXEN] Content preview:', res.doc.substring(0, 200));

                // ✅ IMPROVED: Better Notion content insertion
                const success = await insertContentIntoNotion(res.doc, clearPage);

                if (success) {
                    showToast(`${displayName} Created!`, 'success');
                } else {
                    showToast('Error: Could not insert content', 'error');
                }
            } else if (res?.error === 'AUTH_REQUIRED') {
                showAuthPrompt();
            } else {
                Logger.error('[CRIXEN] Generation failed. Response:', res);
                showToast('Generation failed: ' + (res?.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            Logger.error('[CRIXEN] Generation error:', e);
            if (e.message.includes('validat') || e.message.includes('context')) {
                showToast('Extension updated: Please REFRESH page!', 'error');
            } else {
                showToast('Error: ' + e.message, 'error');
            }
        }
    }

    // ✅ CLIPBOARD VERSION: Bypasses Notion's DOMLock by using native paste
    async function insertContentIntoNotion(markdownContent, clearPage = false) {
        Logger.info('[CRIXEN] Inserting content into Notion via clipboard...', {
            clearPage,
            contentLength: markdownContent?.length
        });

        if (!markdownContent || markdownContent.trim().length === 0) {
            Logger.error('[CRIXEN] No content to insert!');
            return false;
        }

        // ✅ Find editable area
        let target = document.querySelector('[data-content-editable-leaf="true"]') ||
            document.querySelector('.notion-page-content [contenteditable="true"]');

        if (!target) {
            Logger.error('[CRIXEN] No editable area found');
            return false;
        }

        Logger.info('[CRIXEN] Found target:', target);

        // Focus properly
        target.click();
        await sleep(200);
        target.focus();
        await sleep(300);

        // ✅ Clear page if requested
        if (clearPage) {
            const currentText = target.textContent?.trim();
            if (currentText && currentText.length > 0) {
                Logger.info('[CRIXEN] Clearing page...');

                // Use Ctrl+A then Backspace (Notion handles this)
                const isMac = navigator.platform.includes('Mac');

                // Select All
                document.execCommand('selectAll', false, null);
                await sleep(200);

                // Delete
                document.execCommand('delete', false, null);
                await sleep(500);

                // Re-find target
                target = document.querySelector('[data-content-editable-leaf="true"]') ||
                    document.querySelector('.notion-page-content [contenteditable="true"]');

                if (!target) {
                    // Click page to create new block
                    const pageContent = document.querySelector('.notion-page-content');
                    if (pageContent) {
                        pageContent.click();
                        await sleep(500);
                        target = document.querySelector('[data-content-editable-leaf="true"]');
                    }
                }

                if (target) {
                    target.click();
                    target.focus();
                    await sleep(300);
                }
            } else {
                Logger.info('[CRIXEN] Page is already empty, skipping clear');
            }
        }

        if (!target) {
            Logger.error('[CRIXEN] No target available for insertion');
            return false;
        }

        // ✅ INSERT VIA CLIPBOARD PASTE (bypasses DOMLock)
        try {
            Logger.info('[CRIXEN] Converting markdown to HTML and copying to clipboard...');

            // Convert markdown to HTML so Notion formats it properly
            const htmlContent = simpleMarkdownToHtml(markdownContent);
            Logger.info('[CRIXEN] HTML content length:', htmlContent.length);

            // Write both HTML and plain text to clipboard
            // Notion prefers HTML and will format it as blocks
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const clipboardItem = new ClipboardItem({
                'text/html': blob,
                'text/plain': new Blob([markdownContent], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipboardItem]);
            Logger.info('[CRIXEN] Content copied to clipboard (HTML + plain text)');

            // Ensure target is focused
            target.focus();
            await sleep(100);

            // Simulate Ctrl+V / Cmd+V paste
            Logger.info('[CRIXEN] Triggering paste...');

            // Method 1: Use execCommand paste (may not work in all contexts)
            const pasted = document.execCommand('paste');

            if (!pasted) {
                // Method 2: Dispatch paste event with clipboard data
                Logger.info('[CRIXEN] execCommand paste failed, trying ClipboardEvent...');

                const clipboardData = new DataTransfer();
                clipboardData.setData('text/html', htmlContent);
                clipboardData.setData('text/plain', markdownContent);

                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: clipboardData
                });

                target.dispatchEvent(pasteEvent);
            }

            await sleep(500);

            // ✅ Verify insertion worked
            const finalCheck = document.querySelector('[data-content-editable-leaf="true"]');
            if (finalCheck) {
                Logger.info('[CRIXEN] Content insertion completed via clipboard');
                return true;
            } else {
                Logger.warn('[CRIXEN] Editor state may be broken after paste');
                showToast('Content pasted - if empty, try Ctrl+V manually', 'warning');
                return true;
            }

        } catch (error) {
            Logger.error('[CRIXEN] Clipboard insertion failed:', error);

            // ✅ FALLBACK: Show content in a modal for manual copy/paste
            Logger.info('[CRIXEN] Falling back to manual copy modal...');
            showCopyModal(markdownContent);
            return false;
        }
    }

    // ✅ Fallback modal for manual copy/paste when clipboard API fails
    function showCopyModal(content) {
        // Remove existing modal if any
        const existing = document.getElementById('crixen-copy-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'crixen-copy-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e1e1e;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 20px;
            z-index: 999999;
            max-width: 600px;
            max-height: 80vh;
            overflow: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        `;

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #fff; margin: 0; font-size: 16px;">📋 Copy Content Manually</h3>
                <button id="crixen-close-modal" style="background: #333; border: none; color: #fff; padding: 5px 10px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <p style="color: #aaa; font-size: 13px; margin-bottom: 10px;">Clipboard API not available. Click "Copy" below, then paste into Notion with Ctrl+V:</p>
            <textarea id="crixen-copy-content" readonly style="
                width: 100%;
                height: 300px;
                background: #0d0d0d;
                color: #ddd;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 12px;
                font-family: monospace;
                font-size: 12px;
                resize: none;
            ">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="crixen-copy-btn" style="
                    flex: 1;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none;
                    color: #fff;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                ">📋 Copy to Clipboard</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        document.getElementById('crixen-close-modal').onclick = () => modal.remove();
        document.getElementById('crixen-copy-btn').onclick = async () => {
            const textarea = document.getElementById('crixen-copy-content');
            textarea.select();
            try {
                await navigator.clipboard.writeText(content);
                showToast('Copied! Now paste with Ctrl+V', 'success');
            } catch (e) {
                document.execCommand('copy');
                showToast('Copied! Now paste with Ctrl+V', 'success');
            }
        };
    }


    // ✅ NEW: Simple Markdown to HTML Converter
    function simpleMarkdownToHtml(markdown) {
        let html = markdown;

        // 1. Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // 2. Bold & Italic
        html = html.replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>');
        html = html.replace(/\*(.*?)\*/gim, '<i>$1</i>');

        // 3. Lists
        // Basic list support (bullet points)
        html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
        // Fix nested uls (simple regex fallback)
        html = html.replace(/<\/ul>\s*<ul>/gim, '');

        // 4. Tables (Crucial)
        try {
            html = html.replace(/\|(.+)\|\n\|([-:| ]+)\|\n((?:\|.*\|\n?)*)/g, (match, header, separator, body) => {
                const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
                const rows = body.trim().split('\n').map(row => {
                    const cells = row.split('|').filter(c => c.trim() !== '').map(c => `<td>${c.trim()}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                });
                return `<table><thead><tr>${headers}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
            });
        } catch (e) { Logger.error('Table parse error', e); }

        // 5. Line breaks -> <br> or paragraphs
        // Notion handles newlines in HTML reasonably well, but <br> ensures it.
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function analyzeContext() {
        // Updated: Always return 'page' unless it's truly empty,
        // because we want Capture to run anywhere.

        const pageContent = document.querySelector('.notion-page-content');
        if (pageContent) {
            const blocks = pageContent.querySelectorAll('[data-block-id]');
            if (blocks.length < 3) return { type: 'empty' };
        }

        return { type: 'page' }; // Default to page for everything
    }

    // ✅ REDESIGNED: Minimal buttons (Native Feel) with SVG Icons
    function createButton(text, onClick, iconSvg, variant = 'secondary', description = '') {
        const btn = document.createElement('div');
        btn.role = 'button';
        btn.className = 'crixen-notion-btn';

        // Use SVG icon + Text (Size adjusted: 16px icon)
        btn.innerHTML = `<span style="display:flex; align-items:center; margin-right: 6px; width:16px; height:16px;">${iconSvg}</span><span style="font-size:14px;">${text}</span>`;

        // Minimal base styles
        const baseStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px', // Slightly smaller for native feel
            padding: '0 8px',
            borderRadius: '4px', // Standard Notion Radius
            fontSize: '14px',
            fontWeight: '500', // Standard Notion weight
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.1s ease',
            whiteSpace: 'nowrap',
            position: 'relative',
            overflow: 'visible',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: 'inherit', // Inherit Notion's text color
            background: 'transparent' // Default transparent
        };

        Object.assign(btn.style, baseStyles);

        // Tooltip Element
        let tooltip = null;

        btn.onmouseenter = () => {
            // Native-like hover
            btn.style.background = 'rgba(55, 53, 47, 0.08)'; // Notion hover gray

            // Create Tooltip
            if (description) {
                tooltip = document.createElement('div');
                tooltip.textContent = description;
                Object.assign(tooltip.style, {
                    position: 'absolute',
                    top: '110%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#191919',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    zIndex: '1000',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                });
                btn.appendChild(tooltip);
            }
        };

        btn.onmouseleave = () => {
            btn.style.background = 'transparent';
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        };

        btn.onmousedown = () => {
            btn.style.background = 'rgba(55, 53, 47, 0.16)'; // Notion active gray
        };

        btn.onmouseup = () => {
            btn.style.background = 'rgba(55, 53, 47, 0.08)';
        };

        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };

        return btn;
    }

    // --- Shared Logic ---

    async function scrapeStrategies() {
        Logger.info('[CRIXEN] Starting strategy scrape via Clipboard...');

        let clipboardText = '';

        // 1. Check for User Selection first
        const selection = window.getSelection();
        let hasSelection = selection.toString().trim().length > 0;
        let isAutoSelection = false;

        if (!hasSelection) {
            // 2. Select All Content on Page
            Logger.info('[CRIXEN] No selection, selecting page content...');
            // Try to find the main content area, fallback to body
            const pageContent = document.querySelector('.notion-page-content') || document.body;

            const range = document.createRange();
            range.selectNodeContents(pageContent);
            selection.removeAllRanges();
            selection.addRange(range);
            hasSelection = true;
            isAutoSelection = true; // Flag that we auto-selected
            await sleep(100);
        }

        // 3. Copy via Clipboard API or execCommand
        try {
            Logger.info('[CRIXEN] Copying content...');
            const success = document.execCommand('copy');
            if (!success) throw new Error('execCommand copy failed');

            // 4. Read from clipboard by pasting into a hidden textarea
            // Direct navigator.clipboard.readText() often requires permission that content scripts don't have automatically
            Logger.info('[CRIXEN] Reading clipboard via paste hack...');

            const ta = document.createElement('textarea');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();

            const pasteSuccess = document.execCommand('paste');
            if (pasteSuccess && ta.value) {
                clipboardText = ta.value;
            } else {
                Logger.info('[CRIXEN] Paste failed, trying navigator.clipboard.readText()...');
                clipboardText = await navigator.clipboard.readText();
            }
            document.body.removeChild(ta);

        } catch (e) {
            Logger.warn('[CRIXEN] Clipboard copy failed, falling back to DOM parsing', e);
            selection.removeAllRanges();

            // --- Fallback: DOM Scraping (for Popup trigger where clipboard is blocked) ---
            Logger.info('[CRIXEN] Falling back to DOM parsing...');

            // Try to find table rows manually
            // .notion-table-view .notion-table-row is standard for database tables
            // [role="row"] covers more cases
            const rows = document.querySelectorAll('.notion-table-view .notion-table-row, [role="row"]');

            if (rows.length > 0) {
                const domStrategies = [];
                rows.forEach((row, i) => {
                    // Get all text cells
                    // Notion cells usually have data-content-editable-leaf or are inside notion-table-cell-text
                    const cells = Array.from(row.querySelectorAll('[data-content-editable-leaf="true"], .notion-table-cell-text'))
                        .map(c => c.innerText.trim())
                        .filter(t => t.length > 0);

                    if (cells.length >= 2) {
                        const name = cells[0];
                        // Find longest remaining cell
                        const remaining = cells.slice(1);
                        const prompt = remaining.sort((a, b) => b.length - a.length)[0];

                        if (name && prompt) {
                            domStrategies.push({ name, prompt });
                        }
                    } else if (cells.length === 1) {
                        // Single column? Treat as Prompt + Auto-Name
                        const name = 'st' + (i + 1).toString().padStart(2, '0');
                        const prompt = cells[0];
                        domStrategies.push({ name, prompt });
                    }
                });
                Logger.info(`[CRIXEN] DOM Fallback extracted ${domStrategies.length} strategies`);
                return domStrategies;
            }

            return [];
        }

        // Clear selection only if we auto-selected? 
        // For now, let's clear it to be clean.
        selection.removeAllRanges();

        if (!clipboardText) {
            Logger.warn('[CRIXEN] Clipboard was empty');
            return [];
        }

        Logger.info(`[CRIXEN] Got ${clipboardText.length} chars from clipboard`);

        // 5. Parse content 
        const strategies = [];

        // Special Case: Auto-Selection of non-tabular content = Single Strategy
        // (User wants "Page Capture" essentially)
        const isTabular = clipboardText.includes('\t');

        if (isAutoSelection && !isTabular) {
            Logger.info('[CRIXEN] Auto-selection detected as non-tabular. Capturing as single page strategy.');
            strategies.push({
                name: 'Page Content',
                prompt: clipboardText.trim()
            });
            return strategies;
        }

        const lines = clipboardText.split('\n');

        lines.forEach((line, i) => {
            // Split by tabs (usual for Notion table copy)
            const cols = line.split('\t').map(c => c.trim()).filter(c => c);

            if (cols.length >= 2) {
                // Heuristic: Col 1 is Name, Longest other column is Strategy
                const name = cols[0];
                const rest = cols.slice(1);
                // Find longest text in remaining columns (likely the prompt)
                const prompt = rest.sort((a, b) => b.length - a.length)[0];

                if (name && prompt && name.length < 100) { // Safety check
                    strategies.push({ name, prompt });
                }
            } else if (cols.length === 1) {
                // Single column? Treat as Prompt + Auto-Name
                const name = 'st' + (i + 1).toString().padStart(2, '0');
                const prompt = cols[0];
                strategies.push({ name, prompt });
            }
        });

        Logger.info(`[CRIXEN] Extracted ${strategies.length} strategies from clipboard`);
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
        document.querySelectorAll('.crixen-toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-toast';
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
        if (!document.getElementById('crixen-toast-animation')) {
            const style = document.createElement('style');
            style.id = 'crixen-toast-animation';
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

    function showAuthPrompt() {
        const existing = document.querySelectorAll('.crixen-auth-prompt');
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-auth-prompt';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>🔒 Login required to use Crixen</span>
                <button id="crixen-notion-login-btn" style="
                    background: white; 
                    color: #000; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 6px; 
                    font-weight: 600; 
                    cursor: pointer;
                    font-size: 13px;
                ">Login</button>
            </div>
        `;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '10000',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.5)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        document.getElementById('crixen-notion-login-btn').addEventListener('click', () => {
            window.open('https://crixen.xyz', '_blank');
            toast.remove();
        });

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    // Message Listener
    // Message Listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeNotionStrategies') {
            // Must return true to keep message channel open for async response
            scrapeStrategies().then(strategies => {
                sendResponse({ success: true, strategies: strategies });
            });
            return true;
        } else if (request.action === 'pushNotionReport') {
            pushReport(request.stats).then(result => sendResponse(result));
            return true;
        } else if (request.action === 'checkNotionPage') {
            sendResponse({ isNotion: true, title: document.title });
        }
    });

    Logger.info('Crixen: Fully initialized with glassmorphism UI');

    // ✅ NEW: Glassmorphism Input Modal (Dark Theme Optimized + Scrollbar hidden)
    function createInputModal(title, questions, iconSvg) {
        return new Promise((resolve) => {
            // Overlay with strong blur
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '0', transition: 'opacity 0.3s ease'
            });

            // Modal Container - Dark Glass
            const modal = document.createElement('div');
            modal.className = 'crixen-modal-content'; // Class for style injection if needed
            Object.assign(modal.style, {
                width: '480px', maxHeight: '85vh', overflowY: 'auto',
                background: 'rgba(20, 20, 20, 0.95)', // Deep dark
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px', padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                transform: 'translateY(20px)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: '#ffffff',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none' // IE 10+
            });

            // Inject Style for Webkit Scrollbar Hide
            if (!document.getElementById('crixen-scrollbar-style')) {
                const style = document.createElement('style');
                style.id = 'crixen-scrollbar-style';
                style.textContent = `
                    .crixen-modal-content::-webkit-scrollbar { 
                        display: none; 
                    }
                `;
                document.head.appendChild(style);
            }

            // Header Container
            const headerContainer = document.createElement('div');
            Object.assign(headerContainer.style, {
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'
            });

            // Icon (if provided)
            if (iconSvg) {
                const iconContainer = document.createElement('div');
                iconContainer.innerHTML = iconSvg;
                Object.assign(iconContainer.style, {
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px', color: '#fff'
                });
                headerContainer.appendChild(iconContainer);
            }

            // Header Text
            const header = document.createElement('h2');
            header.textContent = title;
            Object.assign(header.style, {
                margin: '0', fontSize: '20px', fontWeight: '700',
                color: '#ffffff', letterSpacing: '-0.5px'
            });
            headerContainer.appendChild(header);

            modal.appendChild(headerContainer);

            // Form Fields
            const fieldValues = {};

            questions.forEach(q => {
                const wrapper = document.createElement('div');
                Object.assign(wrapper.style, { marginBottom: '20px' });

                const label = document.createElement('label');
                label.textContent = q.label + (q.required ? ' *' : '');
                Object.assign(label.style, {
                    display: 'block', marginBottom: '8px',
                    fontSize: '13px', fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.7)',
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                });
                wrapper.appendChild(label);

                // Common Input Styles for Dark Theme
                const inputStyles = {
                    width: '100%', padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    fontSize: '15px', color: '#ffffff',
                    background: 'rgba(255, 255, 255, 0.05)',
                    transition: 'border-color 0.2s, background 0.2s',
                    outline: 'none', fontFamily: 'inherit'
                };

                const focusStyle = (el) => {
                    el.onfocus = () => {
                        el.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        el.style.background = 'rgba(255, 255, 255, 0.1)';
                    };
                    el.onblur = () => {
                        el.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        el.style.background = 'rgba(255, 255, 255, 0.05)';
                    };
                };

                let input;
                if (q.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.rows = 4;
                    Object.assign(input.style, { ...inputStyles, resize: 'vertical', lineHeight: '1.5' });
                    focusStyle(input);
                } else if (q.type === 'select') {
                    input = document.createElement('select');
                    Object.assign(input.style, { ...inputStyles, appearance: 'none', cursor: 'pointer' });
                    // Custom arrow styling or wrapper often needed, but keeping simple for native inject
                    input.innerHTML = `<option value="" disabled selected style="background:#222">Select option...</option>`;
                    q.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        option.style.background = '#222'; // Dark dropdown
                        option.style.color = '#fff';
                        input.appendChild(option);
                    });
                    focusStyle(input);
                } else if (q.type === 'multiselect') {
                    input = document.createElement('div');
                    Object.assign(input.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' });
                    q.options.forEach(opt => {
                        const chip = document.createElement('div');
                        chip.textContent = opt;
                        Object.assign(chip.style, {
                            padding: '8px 14px', borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                            background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.8)',
                            transition: 'all 0.2s', userSelect: 'none'
                        });
                        chip.dataset.selected = 'false';
                        chip.onclick = () => {
                            const isSelected = chip.dataset.selected === 'true';
                            chip.dataset.selected = isSelected ? 'false' : 'true';
                            chip.style.background = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.05)';
                            chip.style.color = isSelected ? '#000000' : 'rgba(255, 255, 255, 0.8)';
                            chip.style.borderColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.15)';
                        };
                        input.appendChild(chip);
                    });
                    input.getValue = () => Array.from(input.children)
                        .filter(c => c.dataset.selected === 'true')
                        .map(c => c.textContent).join(', ');
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    Object.assign(input.style, inputStyles);
                    focusStyle(input);
                }

                if (q.type !== 'multiselect') {
                    input.getValue = () => input.value;
                }

                fieldValues[q.id] = input;
                wrapper.appendChild(input);
                modal.appendChild(wrapper);
            });

            // Footer / Actions
            const actions = document.createElement('div');
            Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            Object.assign(cancelBtn.style, {
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: 'rgba(255, 255, 255, 0.1)', color: '#fff',
                cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                transition: 'background 0.2s'
            });
            cancelBtn.onmouseenter = () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            cancelBtn.onmouseleave = () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            cancelBtn.onclick = () => close(null);

            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Generate ✨';
            Object.assign(submitBtn.style, {
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: '#ffffff', color: '#000000',
                cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)',
                transition: 'transform 0.2s, box-shadow 0.2s'
            });
            submitBtn.onmouseenter = () => {
                submitBtn.style.transform = 'translateY(-1px)';
                submitBtn.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
            };
            submitBtn.onmouseleave = () => {
                submitBtn.style.transform = 'translateY(0)';
                submitBtn.style.boxShadow = '0 4px 15px rgba(255, 255, 255, 0.2)';
            };
            submitBtn.onclick = () => {
                const answers = {};
                let missing = [];
                questions.forEach(q => {
                    const val = fieldValues[q.id].getValue();
                    if (q.required && !val) missing.push(q.label.replace(' *', ''));
                    answers[q.id] = val;
                });

                if (missing.length > 0) {
                    alert(`Please fill in: ${missing.join(', ')}`);
                    return;
                }

                close(answers);
            };

            actions.appendChild(cancelBtn);
            actions.appendChild(submitBtn);
            modal.appendChild(actions);

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Animate In
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'translateY(0)';
            });

            function close(result) {
                overlay.style.opacity = '0';
                modal.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 300);
            }
        });
    }

})();// Crixen - Notion Integration (Native UI Injection)
