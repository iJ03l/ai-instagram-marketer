// Crixen - Notion Integration (Native UI Injection)

(function () {
    'use strict';

    console.log('Crixen: Notion Native Script Loaded');

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
        strategy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        audit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        influencer: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        capture: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        report: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
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
        if (context.type === 'table') {
            container.appendChild(createButton('Capture', async () => {
                const strategies = scrapeStrategies();
                if (strategies.length > 0) {
                    await chrome.runtime.sendMessage({ action: 'saveStrategies', strategies });
                    showToast(`Captured ${strategies.length} strategies!`, 'success');
                } else {
                    showToast('No valid rows found (Need Name & Prompt)', 'error');
                }
            }, ICONS.capture, 'primary', 'Scrape strategies from this table'));

        } else if (context.type === 'empty') {
            // Strategy Button (Primary)
            container.appendChild(createButton('Strategy', async () => {
                const questions = [
                    { id: 'brandName', label: 'Brand/Business Name', type: 'text', required: true },
                    { id: 'industry', label: 'Industry/Niche', type: 'text', required: true },
                    { id: 'audience_mission', label: 'Target Audience, Mission', type: 'textarea', required: true },
                    { id: 'brandVoice', label: 'Brand Voice/Tone', type: 'text' },
                    { id: 'usp', label: 'Unique Selling Point', type: 'textarea' }
                ];
                const answers = await createInputModal('🎯 Brand Strategy Builder', questions);
                if (answers) await generateAndInsertContent('generateStrategyDoc', 'Strategy', null, true, answers);
            }, ICONS.strategy, 'primary', 'Generate a full brand strategy document'));

            // Toolkit Buttons
            // Calendar Tool
            container.appendChild(createButton('Calendar', async () => {
                const questions = [
                    { id: 'brandName', label: 'Brand/Business Name', type: 'text', required: true },
                    { id: 'description', label: 'Description', type: 'textarea' },
                    { id: 'industry', label: 'Industry', type: 'text', required: true },
                    { id: 'frequency', label: 'Posts per Week', type: 'select', options: ['3', '5', '7', '10+'], required: true }
                ];
                const answers = await createInputModal('📅 Content Calendar Setup', questions);
                if (answers) await generateAndInsertContent('generateToolkit', 'Content Calendar', 'calendar', true, answers);
            }, ICONS.calendar, 'secondary', 'Create a social media content calendar'));

            // Audit Tool
            container.appendChild(createButton('Audit', async () => {
                const questions = [
                    { id: 'brandName', label: 'Your Brand Name', type: 'text', required: true },
                    { id: 'industry', label: 'Industry', type: 'text', required: true },
                    { id: 'description', label: 'Description', type: 'textarea' },
                    { id: 'analyze_what', label: 'What to analyze?', type: 'multiselect', options: ['Content Strategy', 'Engagement', 'Visuals', 'Hashtags', 'Competitors'], required: true },
                    { id: 'strength', label: 'Your Current Strength', type: 'text' }
                ];
                const answers = await createInputModal('🔍 Competitor Audit Setup', questions);
                if (answers) await generateAndInsertContent('generateToolkit', 'Competitor Audit', 'audit', true, answers);
            }, ICONS.audit, 'secondary', 'Generate a competitor analysis report'));

            // Influencer Tool
            container.appendChild(createButton('Influencer', async () => {
                const questions = [
                    { id: 'goal', label: 'Campaign Goal', type: 'select', options: ['Brand Awareness', 'Sales/Conversions', 'UGC Creation', 'Event Promotion'], required: true },
                    { id: 'industry', label: 'Industry/Niche', type: 'text', required: true },
                    { id: 'budget', label: 'Budget Range', type: 'select', options: ['$0-$500', '$500-$2000', '$2000-$10k', '$10k+'], required: true },
                    { id: 'platforms', label: 'Target Platforms', type: 'multiselect', options: ['Instagram', 'TikTok', 'YouTube', 'X/Twitter', 'LinkedIn'], required: true },
                    { id: 'deliverables', label: 'Expected Deliverables', type: 'textarea' },
                    { id: 'timeline', label: 'Campaign Timeline', type: 'text' }
                ];
                const answers = await createInputModal('🤝 Influencer Campaign Setup', questions);
                if (answers) await generateAndInsertContent('generateToolkit', 'Influencer Tracker', 'influencer', true, answers);
            }, ICONS.influencer, 'secondary', 'Create an influencer tracking database'));

        } else {
            // Report context
            container.appendChild(createButton('Report', async () => {
                showToast('Fetching stats...', 'info');
                const response = await chrome.runtime.sendMessage({ action: 'getStats' });
                const stats = response.stats || {};
                const result = await pushReport(stats);
                showToast(result.message || 'Done', result.success ? 'success' : 'error');
            }, ICONS.report, 'primary', 'Append daily stats to this page'));
        }

        // Insert into DOM
        actionsContainer.prepend(container);
    }

    // ✅ FIXED: Unified content generation and insertion
    async function generateAndInsertContent(action, displayName, toolType = null, clearPage = false, additionalContext = null) {
        showToast(`Generating ${displayName}... (Wait ~30s)`, 'info');

        try {
            const message = { action, additionalContext };
            if (toolType) message.toolType = toolType;

            const res = await chrome.runtime.sendMessage(message);

            if (res && res.success && res.doc) {
                console.log('[CRIXEN] Received content:', res.doc.substring(0, 100));

                // ✅ IMPROVED: Better Notion content insertion
                const success = await insertContentIntoNotion(res.doc, clearPage);

                if (success) {
                    showToast(`${displayName} Created!`, 'success');
                } else {
                    showToast('Error: Could not insert content', 'error');
                }
            } else {
                showToast('Generation failed: ' + (res?.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            console.error('[CRIXEN] Generation error:', e);
            showToast('Error: ' + e.message, 'error');
        }
    }

    // ✅ COMPLETELY REWRITTEN: Notion content insertion
    async function insertContentIntoNotion(markdownContent, clearPage = false) {
        console.log('[CRIXEN] Inserting content into Notion...', { clearPage });

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
            console.error('[CRIXEN] No editable area found');
            return false;
        }

        console.log('[CRIXEN] Found target:', target);

        // Focus and wait
        target.click();
        target.focus();
        await sleep(300);

        // ✅ Clear page if requested (Robustness)
        if (clearPage) {
            console.log('[CRIXEN] Clearing page content...');
            // Select All
            document.execCommand('selectAll', false, null);
            await sleep(100);
            // Delete
            document.execCommand('delete', false, null);
            await sleep(300);

            // Ensure we are back in focus or have a clean block
            const newTarget = document.querySelector('.notion-page-content [contenteditable="true"]') || target;
            newTarget.focus();
            await sleep(200);
        }

        // ✅ Convert MD to HTML for Rich Paste
        // Notion handles HTML paste much better than raw MD text insertion
        const htmlContent = simpleMarkdownToHtml(markdownContent);
        console.log('[CRIXEN] Converted MD to HTML length:', htmlContent.length);

        // ✅ Dispatch Paste Event (Best for Formatting)
        let success = false;
        try {
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: new DataTransfer()
            });

            // Set both text/plain (fallback) and text/html (rich)
            pasteEvent.clipboardData.setData('text/plain', markdownContent);
            pasteEvent.clipboardData.setData('text/html', htmlContent);

            target.dispatchEvent(pasteEvent);
            console.log('[CRIXEN] Paste event dispatched with HTML');

            await sleep(500);
            success = true;
        } catch (e) {
            console.error('[CRIXEN] Paste failed:', e);

            // Fallback to text insertion if paste fails
            try {
                success = document.execCommand('insertText', false, markdownContent);
            } catch (e2) {
                console.error('[CRIXEN] Fallback insertText failed:', e2);
                success = false;
            }
        }

        return success;
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
        } catch (e) { console.error('Table parse error', e); }

        // 5. Line breaks -> <br> or paragraphs
        // Notion handles newlines in HTML reasonably well, but <br> ensures it.
        html = html.replace(/\n/g, '<br>');

        return html;
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

    // ✅ REDESIGNED: Minimal buttons (Native Feel) with SVG Icons
    function createButton(text, onClick, iconSvg, variant = 'secondary', description = '') {
        const btn = document.createElement('div');
        btn.role = 'button';
        btn.className = 'crixen-notion-btn';

        // Use SVG icon + Text
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

    console.log('Crixen: Fully initialized with glassmorphism UI');

    // ✅ NEW: Glassmorphism Input Modal (Dark Theme Optimized)
    function createInputModal(title, questions) {
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
            Object.assign(modal.style, {
                width: '480px', maxHeight: '85vh', overflowY: 'auto',
                background: 'rgba(20, 20, 20, 0.95)', // Deep dark
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px', padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                transform: 'translateY(20px)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: '#ffffff'
            });

            // Header
            const header = document.createElement('h2');
            header.textContent = title;
            Object.assign(header.style, {
                marginTop: '0', marginBottom: '24px',
                fontSize: '22px', fontWeight: '700',
                color: '#ffffff', letterSpacing: '-0.5px'
            });
            modal.appendChild(header);

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

})();