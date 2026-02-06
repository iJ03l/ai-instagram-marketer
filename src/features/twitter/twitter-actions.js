// Crixen - Twitter Actions

(function () {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;
    const state = window.CrixenTwitter.state;
    // Connect to global logger; fallback to console if missing
    const Logger = window.CrixenLogger || console;

    // --- TYPING ---
    // Enhanced typing simulation for Twitter's Draft.js editors
    window.CrixenTwitter.simulateTyping = async function (element, text) {
        element.focus();
        await utils.sleep(100);

        // Method 1: Try execCommand (works on most Twitter inputs)
        try {
            document.execCommand('selectAll', false, null);
            const success = document.execCommand('insertText', false, text);

            if (success) {
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                await utils.sleep(100);
                return true;
            }
        } catch (e) {
            Logger.warn('[Twitter] execCommand failed, trying fallback');
        }

        // Method 2: Draft.js-specific (for newer Twitter)
        try {
            // Get Draft.js editor state
            const draftEditor = element.closest('.DraftEditor-root');
            if (draftEditor) {
                // Set inner text (Draft.js picks it up)
                element.innerText = text;

                // Trigger Draft.js events
                element.dispatchEvent(new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text
                }));

                element.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: text
                }));

                await utils.sleep(100);
                return true;
            }
        } catch (e) {
            Logger.warn('[Twitter] Draft.js method failed');
        }

        // Method 3: Clipboard paste (most reliable fallback)
        try {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer
            });

            element.dispatchEvent(pasteEvent);
            await utils.sleep(100);

            // Verify it worked
            if (element.textContent.includes(text) || element.innerText.includes(text)) {
                return true;
            }
        } catch (e) {
            Logger.warn('[Twitter] Clipboard method failed');
        }

        // Method 4: Direct manipulation (last resort)
        element.textContent = text;
        element.innerText = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        await utils.sleep(100);
        return true;
    };

    // --- ACTIONS ---

    window.CrixenTwitter.handleReply = async function (tweet) {
        if (state.isProcessing) {
            utils.showToast('⏳ Still processing previous action...', 'warning');
            return;
        }

        state.isProcessing = true;
        state.currentTweet = tweet;

        utils.showToast('🐦 Analyzing Tweet...', 'info');

        try {
            // 1. Extract
            const data = utils.extractTweetContent(tweet);
            Logger.info('[Twitter] Extracted tweet data:', data);

            // 2. Click Reply
            const replyBtn = tweet.querySelector('[data-testid="reply"]');
            if (!replyBtn) {
                throw new Error('Reply button not found on this tweet');
            }

            replyBtn.click();
            utils.showToast('📝 Opening reply...', 'info');

            // 3. Wait for Modal & Input
            const input = await waitForTwitterInput();
            if (!input) {
                throw new Error('Reply composer did not open. Try clicking reply manually first.');
            }

            Logger.info('[Twitter] Input ready:', input);

            // 4. Generate
            await utils.loadSettings();
            const style = state.settings?.defaultStyle || 'witty';

            utils.showToast('🤖 Generating reply...', 'info');

            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: data.text,
                imageUrls: data.images,
                style: style,
                customPrompt: "Twitter reply: Keep under 280 chars. Be concise and impactful. " + (state.settings?.customPrompt || ''),
                platform: 'twitter',
                actionType: 'reply'
            });

            if (!response || !response.success) {
                if (response?.error === 'AUTH_REQUIRED') {
                    throw new Error('AUTH_REQUIRED');
                }
                throw new Error(response?.error || 'AI generation failed');
            }

            Logger.info('[Twitter] Generated reply:', response.comment);

            // 5. Type
            utils.showToast('✍️ Typing reply...', 'info');
            const typed = await utils.simulateTyping(input, response.comment);

            if (!typed) {
                throw new Error('Failed to insert text into composer');
            }

            // Verify text was inserted
            await utils.sleep(500);

            // Normalize whitespace for comparison (ignore newlines/spacing differences)
            const getNormalizedText = (str) => (str || '').replace(/\s+/g, ' ').trim();

            const currentText = getNormalizedText(input.textContent || input.innerText);
            const expectedStart = getNormalizedText(response.comment).substring(0, 20);

            if (!currentText.includes(expectedStart)) {
                Logger.warn('[Twitter] Text insertion verification failed');
                Logger.warn('Expected start:', expectedStart);
                Logger.warn('Actual content:', currentText);
                utils.showToast('⚠️ Text check failed. Verify content.', 'warning');
            }

            // 6. Post (Click Reply)
            utils.showToast('📤 Posting reply...', 'info');
            const posted = await clickTwitterPostButton();

            if (!posted) {
                throw new Error('Could not click post button. You may need to click it manually.');
            }

        } catch (e) {
            Logger.error('[Twitter] Reply error:', e);

            if (e.message.includes('validat') || e.message.includes('Invocation of form') || e.message.includes('context')) {
                utils.showToast('⚠️ Extension updated: Please REFRESH page!', 'error');
            } else if (e.message === 'AUTH_REQUIRED') {
                if (typeof utils.showAuthPrompt === 'function') {
                    utils.showAuthPrompt();
                } else {
                    utils.showToast('🔐 Login required. Open Crixen dashboard.', 'error');
                }
            } else {
                utils.showToast('❌ ' + (e.message || 'Reply failed'), 'error');
            }
        } finally {
            state.isProcessing = false;
        }
    };

    window.CrixenTwitter.handleQuote = async function (tweet) {
        if (state.isProcessing) return;
        state.isProcessing = true;

        utils.showToast('🐦 Analyzing for Quote...', 'info');

        const data = utils.extractTweetContent(tweet);

        // 1. Click Retweet
        const rtBtn = tweet.querySelector('[data-testid="retweet"]');
        if (!rtBtn) {
            utils.showToast('Retweet button not found', 'error');
            state.isProcessing = false;
            return;
        }
        rtBtn.click();

        await utils.sleep(500);

        // 2. Click Quote in menu
        const quoteMenuItem = document.querySelector('[data-testid="retweetConfirm"]');

        const menuItems = document.querySelectorAll('[role="menuitem"]');
        let quoteBtn = null;
        for (const item of menuItems) {
            if (item.textContent.includes('Quote')) {
                quoteBtn = item;
                break;
            }
        }

        if (!quoteBtn) {
            utils.showToast('Quote option not found', 'error');
            state.isProcessing = false;
            return;
        }
        quoteBtn.click();

        // 3. Wait for Input
        const input = await waitForTwitterInput();
        if (!input) {
            utils.showToast('Quote input not found', 'error');
            state.isProcessing = false;
            return;
        }

        // 4. Generate
        await utils.loadSettings();
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: data.text,
                style: 'witty',
                customPrompt: "Generate a quote tweet. Add value or a funny take.",
                platform: 'twitter',
                actionType: 'quote'
            });

            if (!response || !response.success) throw new Error('Generation failed');

            await utils.simulateTyping(input, response.comment);
            await clickTwitterPostButton();

        } catch (e) {
            utils.showToast(e.message, 'error');
        } finally {
            state.isProcessing = false;
        }
    };

    window.CrixenTwitter.handleCreatePost = async function () {
        if (state.isProcessing) return;
        state.isProcessing = true;

        // 1. Prompt for Topic
        const topic = prompt("What should this post be about? (Topic/Vibe)");
        if (!topic) {
            state.isProcessing = false;
            return;
        }

        utils.showToast('✨ Generating Post...', 'info');

        // 2. Open Composer
        // Find the global "Post" button using aria-label or testid
        const postBtn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
        if (postBtn) {
            postBtn.click();
        } else {
            // Fallback: Keyboard shortcut 'n' if focused on body
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
        }

        // 3. Wait for Modal Input
        const input = await waitForTwitterInput();
        if (!input) {
            utils.showToast('Composer not found', 'error');
            state.isProcessing = false;
            return;
        }

        // 4. Generate
        await utils.loadSettings();
        try {
            // Check if extension context is still valid before making the call
            if (!chrome.runtime?.id) {
                throw new Error('CONTEXT_INVALID');
            }

            const response = await chrome.runtime.sendMessage({
                action: 'generatePost',
                topic: topic,
                platform: 'twitter'
            });

            if (chrome.runtime.lastError) {
                throw new Error('CONTEXT_INVALID');
            }

            if (!response || !response.success) {
                if (response?.error === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
                throw new Error(response?.error || 'Generation failed');
            }

            // 5. Type
            utils.showToast('✍️ Typing post...', 'info');
            await utils.simulateTyping(input, response.comment);

            // 6. Ready to send
            utils.showToast('✅ Ready to post!', 'success');

        } catch (e) {
            Logger.error('AI Post:', e);
            if (e.message === 'AUTH_REQUIRED') {
                if (typeof utils.showAuthPrompt === 'function') {
                    utils.showAuthPrompt();
                } else {
                    utils.showToast('Login required', 'error');
                }
            } else if (e.message === 'CONTEXT_INVALID' || e.message.includes('context') || e.message.includes('invalidat')) {
                utils.showToast('⚠️ Extension updated - Please REFRESH this page!', 'error');
            } else {
                utils.showToast(e.message || 'Generation failed', 'error');
            }
        } finally {
            state.isProcessing = false;
        }
    };

    // --- HELPERS ---

    async function waitForTwitterInput() {
        const selectors = [
            '[data-testid="tweetTextarea_0"]',      // Primary composer
            '[contenteditable="true"][role="textbox"]', // Generic editable
            '.DraftEditor-editorContainer [contenteditable="true"]', // Draft.js editor
            '[data-testid="tweetTextarea_1"]',      // Sometimes numbered differently
        ];

        let attempts = 0;
        while (attempts < 30) {
            for (const selector of selectors) {
                const input = document.querySelector(selector);
                if (input && utils.isElementVisible(input)) {
                    Logger.debug('[Twitter] Found input with selector:', selector);

                    // Focus and verify it's ready
                    input.focus();
                    await utils.sleep(100);

                    // Check if it's actually editable
                    const isEditable = input.isContentEditable ||
                        input.getAttribute('contenteditable') === 'true';

                    if (isEditable) return input;
                }
            }

            await utils.sleep(200);
            attempts++;
        }

        Logger.error('[Twitter] Input not found after', attempts, 'attempts');
        return null;
    }

    async function clickTwitterPostButton() {
        await utils.sleep(500);

        // Try multiple selectors in order of likelihood
        const selectors = [
            '[data-testid="tweetButtonInline"]',  // Most common (replies, inline)
            '[data-testid="tweetButton"]',        // Quote tweets, main compose
            '[role="button"][data-testid*="tweet"]', // Fallback pattern
            'div[role="button"] span:has-text("Post")', // Text-based (risky, language-dependent)
            'div[role="button"] span:has-text("Reply")', // Reply context
        ];

        let postButton = null;

        // Try each selector
        for (const selector of selectors) {
            try {
                const btn = document.querySelector(selector);
                if (btn && utils.isElementVisible(btn) && !btn.disabled && !btn.getAttribute('aria-disabled')) {
                    postButton = btn;
                    Logger.debug('[Twitter] Found post button with selector:', selector);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Fallback: Look for visible button with "Post" or "Reply" text
        if (!postButton) {
            const allButtons = document.querySelectorAll('div[role="button"]');
            for (const btn of allButtons) {
                const text = btn.textContent.trim().toLowerCase();
                if ((text === 'post' || text === 'reply' || text === 'tweet') &&
                    utils.isElementVisible(btn) &&
                    !btn.disabled &&
                    !btn.getAttribute('aria-disabled')) {
                    postButton = btn;
                    Logger.debug('[Twitter] Found post button by text:', text);
                    break;
                }
            }
        }

        if (postButton) {
            // Check if button is actually clickable (not disabled by Twitter's validation)
            const isDisabled = postButton.disabled ||
                postButton.getAttribute('aria-disabled') === 'true' ||
                postButton.classList.contains('disabled');

            if (isDisabled) {
                Logger.warn('[Twitter] Post button found but disabled');
                utils.showToast('⚠️ Button disabled (check character limit or content)', 'warning');
                return false;
            }

            // Click with fallback methods
            try {
                postButton.click();
            } catch (e) {
                // Fallback: Dispatch click event
                postButton.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            }

            utils.showToast('✅ Posted!', 'success');
            return true;
        } else {
            Logger.error('[Twitter] Post button not found. Available buttons:',
                Array.from(document.querySelectorAll('div[role="button"]')).map(b => b.outerHTML));
            utils.showToast('❌ Post button not found', 'error');
            return false;
        }
    }

    window.CrixenTwitter.debugTwitterUI = function () {
        Logger.group('🐛 Twitter UI Debug');

        Logger.debug('Available textareas:',
            Array.from(document.querySelectorAll('[data-testid*="tweet"]')).map(el => ({
                testid: el.getAttribute('data-testid'),
                visible: utils.isElementVisible(el),
                text: el.textContent.substring(0, 50)
            }))
        );

        Logger.debug('Available buttons:',
            Array.from(document.querySelectorAll('div[role="button"]')).map(el => ({
                text: el.textContent.trim(),
                testid: el.getAttribute('data-testid'),
                visible: utils.isElementVisible(el),
                disabled: el.disabled || el.getAttribute('aria-disabled')
            }))
        );

        Logger.debug('Modal state:',
            document.querySelector('[role="dialog"]') ? 'OPEN' : 'CLOSED'
        );

        Logger.groupEnd();
    };

})();
