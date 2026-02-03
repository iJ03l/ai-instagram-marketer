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

        // Create Container with glassmorphism
        const container = document.createElement('div');
        container.id = 'crixen-ai-controls';
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
            }, '🎨', 'primary', 'Scrape strategies from this table'));

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
            }, '✨', 'primary', 'Generate a full brand strategy document'));

            // Toolkit Buttons
            container.appendChild(createButton('Calendar', async () => {
                const questions = [
                    { id: 'brandName', label: 'Brand/Business Name', type: 'text', required: true },
                    { id: 'description', label: 'Description', type: 'textarea' },
                    { id: 'industry', label: 'Industry', type: 'text', required: true },
                    { id: 'frequency', label: 'Posts per Week', type: 'select', options: ['3', '5', '7', '10+'], required: true }
                ];
                const answers = await createInputModal('📅 Content Calendar Setup', questions);
                if (answers) await generateAndInsertContent('generateToolkit', 'Content Calendar', 'calendar', true, answers);
            }, '📅', 'secondary', 'Create a social media content calendar'));

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
            }, '🔍', 'secondary', 'Generate a competitor analysis report'));

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
            }, '🤝', 'secondary', 'Create an influencer tracking database'));

        } else {
            // Report context
            container.appendChild(createButton('Push Report', async () => {
                showToast('Fetching stats...', 'info');
                const response = await chrome.runtime.sendMessage({ action: 'getStats' });
                const stats = response.stats || {};
                const result = await pushReport(stats);
                showToast(result.message || 'Done', result.success ? 'success' : 'error');
            }, '📊', 'primary', 'Append daily stats to this page'));
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

    // ✅ REDESIGNED: Glassmorphism buttons with Tooltips
    function createButton(text, onClick, icon, variant = 'secondary', description = '') {
        const btn = document.createElement('div');
        btn.role = 'button';
        btn.className = 'crixen-notion-btn';
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
            overflow: 'visible', // Changed to visible for tooltips
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
        }

        // Tooltip Element
        let tooltip = null;

        btn.onmouseenter = () => {
            // Hover Style
            if (variant === 'primary') {
                btn.style.transform = 'translateY(-2px) scale(1.02)';
                btn.style.background = 'rgba(0, 0, 0, 0.95)';
                btn.style.boxShadow = '0 8px 25px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            } else {
                btn.style.background = 'rgba(30, 30, 30, 0.8)';
                btn.style.transform = 'translateY(-1px)';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            }

            // Create Tooltip
            if (description) {
                tooltip = document.createElement('div');
                tooltip.textContent = description;
                Object.assign(tooltip.style, {
                    position: 'absolute',
                    top: '120%', // Below button
                    left: '50%',
                    transform: 'translateX(-50%) translateY(0)', // Start slightly down?
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    zIndex: '1000',
                    pointerEvents: 'none',
                    opacity: '0',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)'
                });
                btn.appendChild(tooltip);

                // Animate in
                requestAnimationFrame(() => {
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'translateX(-50%) translateY(4px)';
                });
            }
        };

        btn.onmouseleave = () => {
            // Restore Style
            if (variant === 'primary') {
                btn.style.transform = 'translateY(0) scale(1)';
                btn.style.background = 'rgba(20, 20, 20, 0.85)';
                btn.style.boxShadow = '0 4px 16px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            } else {
                btn.style.background = 'rgba(40, 40, 40, 0.7)';
                btn.style.transform = 'translateY(0)';
                btn.style.color = '#e0e0e0';
                btn.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
            }

            // Remove Tooltip
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) tooltip.remove();
                    tooltip = null;
                }, 200);
            }
        };

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
                pointerEvents: 'none',
                overflow: 'hidden' // Important for ripple to be contained if we set btn overflow to visible
            });

            // Note: Since we set overflow: visible on btn for tooltips, we need to handle ripple overflow differently.
            // Actually, ripple is usually fine bursting out, or we wrap inner content. 
            // Simplified: let it burst or clip it with a wrapper. For now, let's just append.
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);

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

    // ✅ NEW: Glassmorphism Input Modal
    function createInputModal(title, questions) {
        return new Promise((resolve) => {
            // Overlay
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
                zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '0', transition: 'opacity 0.3s ease'
            });

            // Modal Container
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                width: '450px', maxHeight: '85vh', overflowY: 'auto',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '16px', padding: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                transform: 'translateY(20px)', transition: 'transform 0.3s ease',
                fontFamily: '-apple-system, system-ui, sans-serif'
            });

            // Header
            const header = document.createElement('h2');
            header.textContent = title;
            Object.assign(header.style, { marginTop: '0', marginBottom: '20px', fontSize: '20px', fontWeight: '700', color: '#111' });
            modal.appendChild(header);

            // Form Fields
            const fieldValues = {};

            questions.forEach(q => {
                const wrapper = document.createElement('div');
                Object.assign(wrapper.style, { marginBottom: '16px' });

                const label = document.createElement('label');
                label.textContent = q.label + (q.required ? ' *' : '');
                Object.assign(label.style, { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#444' });
                wrapper.appendChild(label);

                let input;
                if (q.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.rows = 3;
                    Object.assign(input.style, {
                        width: '100%', padding: '10px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '14px', resize: 'vertical'
                    });
                } else if (q.type === 'select') {
                    input = document.createElement('select');
                    Object.assign(input.style, {
                        width: '100%', padding: '10px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '14px', background: 'white'
                    });
                    q.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        input.appendChild(option);
                    });
                } else if (q.type === 'multiselect') {
                    input = document.createElement('div');
                    Object.assign(input.style, { display: 'flex', flexWrap: 'wrap', gap: '8px' });
                    q.options.forEach(opt => {
                        const chip = document.createElement('div');
                        chip.textContent = opt;
                        Object.assign(chip.style, {
                            padding: '6px 12px', borderRadius: '20px',
                            border: '1px solid #ddd', cursor: 'pointer', fontSize: '13px',
                            background: '#f5f5f5', transition: 'all 0.2s', userSelect: 'none'
                        });
                        chip.dataset.selected = 'false';
                        chip.onclick = () => {
                            const isSelected = chip.dataset.selected === 'true';
                            chip.dataset.selected = isSelected ? 'false' : 'true';
                            chip.style.background = isSelected ? '#f5f5f5' : '#333';
                            chip.style.color = isSelected ? '#333' : '#fff';
                            chip.style.borderColor = isSelected ? '#ddd' : '#333';
                        };
                        input.appendChild(chip);
                    });
                    // Helper to get values
                    input.getValue = () => Array.from(input.children)
                        .filter(c => c.dataset.selected === 'true')
                        .map(c => c.textContent).join(', ');
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    Object.assign(input.style, {
                        width: '100%', padding: '10px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '14px'
                    });
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
            Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            Object.assign(cancelBtn.style, {
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: '#f0f0f0', color: '#333', cursor: 'pointer', fontWeight: '600'
            });
            cancelBtn.onclick = () => close(null);

            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Generate ✨';
            Object.assign(submitBtn.style, {
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: '#000', color: '#fff', cursor: 'pointer', fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            });
            submitBtn.onclick = () => {
                // Collect and Validate
                const answers = {};
                let missing = [];
                questions.forEach(q => {
                    const val = fieldValues[q.id].getValue();
                    if (q.required && !val) missing.push(q.label);
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