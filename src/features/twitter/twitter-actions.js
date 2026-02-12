// Crixen - Twitter Actions (With Thread/Longform Fix)

(() => {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;
    const state = window.CrixenTwitter.state;
    const Logger = window.CrixenLogger || console;

    // ---------- typing ----------
    utils.simulateTyping = async function (element, text) {
        element.focus();
        await utils.sleep(80);

        try {
            document.execCommand('selectAll', false, null);
            const ok = document.execCommand('insertText', false, text);
            if (ok) {
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        } catch { }

        try {
            element.innerText = text;
            element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
            return true;
        } catch { }

        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };

    // ---------- composer helpers ----------

    async function waitForTwitterComposerRoot(timeoutMs = 6000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) return dialog;
            await utils.sleep(120);
        }
        return null;
    }

    async function waitForTwitterInput(timeoutMs = 6000, context = document) {
        const selectors = [
            '[data-testid="tweetTextarea_0"]',
            '[data-testid="tweetTextarea_1"]',
            '[contenteditable="true"][role="textbox"]',
            '.DraftEditor-editorContainer [contenteditable="true"]'
        ];

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            for (const sel of selectors) {
                const el = context.querySelector(sel);
                if (el && utils.isElementVisible(el) && (el.isContentEditable || el.getAttribute('contenteditable') === 'true')) {
                    return el;
                }
            }
            await utils.sleep(150);
        }
        return null;
    }

    async function clickTwitterPostButton(context = document) {
        await utils.sleep(250);

        const selectors = [
            '[data-testid="tweetButtonInline"]',
            '[data-testid="tweetButton"]'
        ];

        for (const sel of selectors) {
            const btn = context.querySelector(sel);
            if (btn && utils.isElementVisible(btn) && btn.getAttribute('aria-disabled') !== 'true') {
                btn.click();
                return true;
            }
        }

        const btns = Array.from(context.querySelectorAll('div[role="button"],button'));
        const found = btns.find((b) => {
            const t = (b.textContent || '').trim().toLowerCase();
            return (t === 'post' || t === 'reply' || t === 'tweet') && utils.isElementVisible(b) && b.getAttribute('aria-disabled') !== 'true';
        });

        if (found) {
            found.click();
            return true;
        }

        return false;
    }

    async function clickAddTweetToThread() {
        await utils.sleep(250);

        const candidates = [
            document.querySelector('[data-testid="addTweetButton"]'),
            document.querySelector('[aria-label*="Add another post"]'),
            document.querySelector('[aria-label*="Add another Tweet"]'),
            document.querySelector('div[role="button"][aria-label*="Add"]')
        ].filter(Boolean);

        const btn = candidates.find((b) => utils.isElementVisible(b));
        if (btn) {
            btn.click();
            return true;
        }
        return false;
    }

    // ---------- actions ----------

    utils.handleReply = async function (tweet) {
        if (state.isProcessing) {
            utils.showToast('Still processing...', 'warning');
            return false;
        }

        state.isProcessing = true;
        state.currentTweet = tweet;

        try {
            utils.showToast('Analyzing tweet...', 'info');

            const data = utils.extractTweetContent(tweet);

            const replyBtn = tweet.querySelector('[data-testid="reply"]');
            if (!replyBtn) throw new Error('Reply button not found');
            replyBtn.click();

            utils.showToast('Opening reply...', 'info');
            const dialog = await waitForTwitterComposerRoot(4000);
            const input = await waitForTwitterInput(7000, dialog || document);
            if (!input) throw new Error('Reply composer did not open');

            await utils.loadSettings();
            const style = state.settings?.defaultStyle || 'witty';

            utils.showToast('Generating reply...', 'info');

            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: data.text,
                imageUrls: data.images,
                style,
                customPrompt:
                    'X reply: under 280 chars. One sharp point. No unrelated questions. No generic praise. ' +
                    (state.settings?.customPrompt || ''),
                platform: 'twitter',
                actionType: 'reply'
            });

            if (!response?.success) {
                if (response?.code === 'AUTH_REQUIRED' || response?.error === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
                throw new Error(response?.error || 'Generation failed');
            }

            const typed = await utils.simulateTyping(input, response.comment);
            if (!typed) throw new Error('Failed to type');

            utils.showToast('Posting...', 'info');
            const posted = await clickTwitterPostButton(dialog || document);
            if (!posted) throw new Error('Could not click post button');

            utils.showToast('Posted', 'success');
            return true;
        } catch (e) {
            Logger.error('[Twitter] Reply error', e);
            if (e.message === 'AUTH_REQUIRED') utils.showAuthPrompt?.();
            else utils.showToast(e?.message || 'Reply failed', 'error');
            return false;
        } finally {
            state.isProcessing = false;
        }
    };

    utils.handleQuote = async function (tweet) {
        if (state.isProcessing) return false;
        state.isProcessing = true;

        try {
            utils.showToast('Preparing quote...', 'info');

            const data = utils.extractTweetContent(tweet);

            const rtBtn = tweet.querySelector('[data-testid="retweet"]');
            if (!rtBtn) throw new Error('Retweet button not found');
            rtBtn.click();
            await utils.sleep(350);

            const menuItems = document.querySelectorAll('[role="menuitem"]');
            const quoteBtn = Array.from(menuItems).find((i) => (i.textContent || '').includes('Quote'));
            if (!quoteBtn) throw new Error('Quote option not found');
            quoteBtn.click();

            const input = await waitForTwitterInput(7000);
            if (!input) throw new Error('Quote composer not found');

            await utils.loadSettings();
            const style = state.settings?.defaultStyle || 'witty';

            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: data.text,
                style,
                customPrompt:
                    'X quote tweet: add a new angle, insight, or punchline. No generic praise. No unrelated questions. ' +
                    (state.settings?.customPrompt || ''),
                platform: 'twitter',
                actionType: 'quote'
            });

            if (!response?.success) {
                if (response?.code === 'AUTH_REQUIRED' || response?.error === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
                throw new Error(response?.error || 'Generation failed');
            }

            await utils.simulateTyping(input, response.comment);
            const posted = await clickTwitterPostButton();
            if (!posted) throw new Error('Could not click post button');

            utils.showToast('Posted', 'success');
            return true;
        } catch (e) {
            Logger.error('[Twitter] Quote error', e);
            if (e.message === 'AUTH_REQUIRED') utils.showAuthPrompt?.();
            else utils.showToast(e?.message || 'Quote failed', 'error');
            return false;
        } finally {
            state.isProcessing = false;
        }
    };

    // ✅ FIXED: Create post with proper thread/longform handling
    utils.handleCreatePost = async function () {
        if (state.isProcessing) return;
        state.isProcessing = true;

        try {
            await utils.loadSettings();

            const inputResult = await utils.showPostModal?.();
            if (!inputResult) return false;

            const { topic, mode } = inputResult;
            const actionType = mode === 'thread' ? 'thread' : mode === 'longform' ? 'longform' : 'post';

            utils.showToast('Opening composer...', 'info');

            const openBtn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
            if (openBtn) openBtn.click();
            else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));

            const input = await waitForTwitterInput(7000);
            if (!input) throw new Error('Composer not found');

            utils.showToast(`Generating ${actionType}...`, 'info');

            const response = await chrome.runtime.sendMessage({
                action: 'generatePost',
                topic,
                platform: 'twitter',
                actionType
            });

            if (!response?.success) {
                if (response?.code === 'AUTH_REQUIRED' || response?.error === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
                throw new Error(response?.error || 'Generation failed');
            }

            const content = String(response.comment || '').trim();
            if (!content) throw new Error('Empty content');

            if (actionType === 'thread') {
                // ✅ Split by double newlines (AI outputs tweets separated by \n\n)
                const tweets = content.split(/\n\n+/g)
                    .map(t => t.trim())
                    .filter(t => t.length > 0);

                console.log(`[Thread] Split into ${tweets.length} tweets:`, tweets);

                if (tweets.length < 2) {
                    throw new Error(`Thread must have at least 2 tweets. Got: ${tweets.length}`);
                }

                // Type first tweet
                await utils.simulateTyping(input, tweets[0]);
                await utils.sleep(300);

                // Add remaining tweets
                for (let i = 1; i < tweets.length; i++) {
                    const added = await clickAddTweetToThread();
                    if (!added) {
                        utils.showToast(`Added ${i} of ${tweets.length} tweets. Add rest manually.`, 'warning');
                        break;
                    }

                    await utils.sleep(500);
                    const nextInput = await waitForTwitterInput(5000);
                    if (!nextInput) {
                        utils.showToast(`Could not find input for tweet ${i + 1}`, 'warning');
                        break;
                    }

                    await utils.simulateTyping(nextInput, tweets[i]);
                    await utils.sleep(200);
                }

                utils.showToast(`Thread ready (${tweets.length} tweets)`, 'success');
                return true;
            }

            // post / longform just type into composer
            await utils.simulateTyping(input, content);
            utils.showToast(actionType === 'longform' ? 'Long post ready' : 'Post ready', 'success');
            return true;
        } catch (e) {
            Logger.error('[Twitter] CreatePost error', e);
            if (e.message === 'AUTH_REQUIRED') utils.showAuthPrompt?.();
            else utils.showToast(e?.message || 'Failed', 'error');
            return false;
        } finally {
            state.isProcessing = false;
        }
    };

})();