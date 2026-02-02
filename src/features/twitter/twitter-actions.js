// SMITH ai - Twitter Actions

(function () {
    'use strict';

    window.SmithTwitter = window.SmithTwitter || {};
    const utils = window.SmithTwitter;
    const state = window.SmithTwitter.state;

    // --- TYPING ---
    // Reusing the robust typing simulation from Instagram
    window.SmithTwitter.simulateTyping = async function (element, text) {
        element.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await utils.sleep(100);
        return true;
    };

    // --- ACTIONS ---

    window.SmithTwitter.handleReply = async function (tweet) {
        if (state.isProcessing) return;
        state.isProcessing = true;
        state.currentTweet = tweet;

        utils.showToast('🐦 Analyzing Tweet...', 'info');

        // 1. Extract
        const data = utils.extractTweetContent(tweet);

        // 2. Click Reply
        const replyBtn = tweet.querySelector('[data-testid="reply"]');
        if (!replyBtn) {
            utils.showToast('Reply button not found', 'error');
            state.isProcessing = false;
            return;
        }
        replyBtn.click();

        // 3. Wait for Modal & Input
        const input = await waitForTwitterInput();
        if (!input) {
            utils.showToast('Reply input not found', 'error');
            state.isProcessing = false;
            return;
        }

        // 4. Generate
        await utils.loadSettings();
        const style = state.settings?.defaultStyle || 'witty';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: data.text,
                imageUrls: data.images,
                style: style,
                customPrompt: "Note: This is a tweet reply. Keep it short, under 280 chars. " + (state.settings?.customPrompt || '')
            });

            if (!response || !response.success) throw new Error(response?.error || 'Generation failed');

            // 5. Type
            utils.showToast('✍️ Typing reply...', 'info');
            await utils.simulateTyping(input, response.comment);

            // 6. Post (Click Reply)
            await clickTwitterPostButton();

        } catch (e) {
            utils.showToast('Error: ' + e.message, 'error');
        } finally {
            state.isProcessing = false;
        }
    };

    window.SmithTwitter.handleQuote = async function (tweet) {
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
        const quoteMenuItem = document.querySelector('[data-testid="retweetConfirm"]'); // Usually the quote option is separate, checking menu
        // Actually usually a dropdown: Retweet, Quote.
        // Needs finding the "Quote" text or specific testid.
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
                customPrompt: "Generate a quote tweet. Add value or a funny take."
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

    // --- HELPERS ---

    async function waitForTwitterInput() {
        // [data-testid="tweetTextarea_0"]
        let attempts = 0;
        while (attempts < 20) {
            const input = document.querySelector('[data-testid="tweetTextarea_0"]'); // Standard ID for primary composer
            if (input && utils.isElementVisible(input)) return input;
            await utils.sleep(200);
            attempts++;
        }
        return null; // document.activeElement as fallback?
    }

    async function clickTwitterPostButton() {
        await utils.sleep(500);
        // [data-testid="tweetButton"]
        const btn = document.querySelector('[data-testid="tweetButton"]');
        if (btn && !btn.disabled) {
            btn.click();
            utils.showToast('✅ Sent!', 'success');
        } else {
            utils.showToast('Post button disabled/missing', 'warning');
        }
    }

})();
