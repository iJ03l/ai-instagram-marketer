// Instagram AI Comment Assistant - Actions & Interaction (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;
    const state = window.InstagramAssistant.state;

    // -------- typing (react-safe) --------

    utils.simulateTyping = async function (element, text) {
        window.focus();
        element.focus();
        await utils.sleep(50);

        const isCE = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

        // Best path for IG (contenteditable): execCommand insertText
        try {
            if (isCE) {
                document.execCommand('selectAll', false, null);
                const ok = document.execCommand('insertText', false, text);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                if (ok) return true;
            }
        } catch {
            // ignore
        }

        // Textarea: use native setter so React sees it
        try {
            if (element.tagName === 'TEXTAREA') {
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                if (setter) setter.call(element, text);
                else element.value = text;

                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        } catch {
            // ignore
        }

        // Fallback
        try {
            element.textContent = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch {
            // ignore
        }

        return false;
    };

    function getComposerText(el) {
        if (!el) return '';
        if (el.tagName === 'TEXTAREA') return el.value || '';
        return el.textContent || '';
    }

    function normalizeForMatch(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '') // remove punctuation, unicode-safe
            .trim();
    }

    async function waitForTextInContainer(container, text, timeoutMs = 6500) {
        const target = normalizeForMatch(text).slice(0, 120);
        if (!target) return false;

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const current = normalizeForMatch(container?.innerText || '');
            if (current.includes(target)) return true;
            await utils.sleep(200);
        }
        return false;
    }

    async function ensurePostButtonEnabled(inputEl, container) {
        // Try multiple nudges to get React/IG to enable the Post button
        for (let i = 0; i < 12; i++) {
            const btn = utils.findPostButtonInContainer(container);
            if (btn && !btn.disabled) return btn;

            inputEl.focus();

            // Nudge (often wakes IG):
            // insert space then delete space
            try {
                document.execCommand('insertText', false, ' ');
                await utils.sleep(35);
                document.execCommand('delete', false, null);
            } catch {
                // Fallback: dispatch input
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await utils.sleep(180);
        }

        return utils.findPostButtonInContainer(container);
    }

    async function verifyPosted({ dialogOrForm, beforeSnapshot, comment }) {
        // Verification heuristics (in order):
        // 1) Composer cleared
        // 2) Dialog text changed
        // 3) Comment text appears in dialog (best effort)
        await utils.sleep(900);

        const input = await utils.waitForStrictInput(1200);
        if (input) {
            const t = getComposerText(input).trim();
            if (!t) return true;
        }

        const afterText = (dialogOrForm?.innerText || '').slice(0, 2000);
        if (beforeSnapshot && afterText && afterText !== beforeSnapshot) {
            // It changed - might be posted, might be re-render. Continue to stronger check:
            if (comment) {
                const appeared = await waitForTextInContainer(dialogOrForm, comment, 4500);
                if (appeared) return true;
            }
            // If we can't confirm appearance, still accept change as weak success signal:
            return true;
        }

        if (comment) {
            const appeared = await waitForTextInContainer(dialogOrForm, comment, 4500);
            if (appeared) return true;
        }

        return false;
    }

    utils.postCommentInModal = async function (comment, startUrl) {
        utils.showToast('Posting...', 'info');

        let input = await utils.waitForStrictInput(6500);
        if (!input) {
            utils.showToast('Input not found. Click the box and try again.', 'warning');
            state.isProcessing = false;
            return false;
        }

        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await utils.sleep(250);

        input.focus();
        input.click();
        await utils.sleep(150);

        const typed = await utils.simulateTyping(input, comment);
        if (!typed) {
            utils.showToast('Failed to insert text', 'error');
            state.isProcessing = false;
            return false;
        }

        await utils.sleep(350);

        const container = input.closest('form') || input.closest('div[role="dialog"]') || document.body;

        const beforeSnapshot = (container?.innerText || '').slice(0, 2000);
        const postBtn = await ensurePostButtonEnabled(input, container);

        if (!postBtn || postBtn.disabled) {
            utils.showToast('Post button not available', 'error');
            state.isProcessing = false;
            return false;
        }

        postBtn.click();

        const ok = await verifyPosted({ dialogOrForm: container, beforeSnapshot, comment });

        if (ok) {
            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'posted' }).catch(() => { });
            }

            utils.showToast('✅ Comment posted!', 'success');

            if (state.currentPost) state.currentPost.dataset.aiCommented = 'true';

            setTimeout(() => utils.closeModal(startUrl), 1200);

            state.isProcessing = false;
            return true;
        }

        utils.showToast('Post may not have sent. Check and retry.', 'warning');
        state.isProcessing = false;
        return false;
    };

    utils.handleGenerateClick = async function (post) {
        if (!utils.isExtensionValid()) {
            utils.showToast('Extension needs refresh', 'warning');
            return false;
        }

        // Strong single-flight lock
        if (state.isProcessing) {
            utils.showToast('Already processing...', 'warning');
            return false;
        }

        state.isProcessing = true;
        state.currentPost = post;

        const startUrl = window.location.href;

        try {
            utils.showToast('Analyzing + generating...', 'info');

            const postData = utils.extractPostContent?.(post);
            if (!postData?.text || postData.text.length < 8) {
                utils.showToast('No caption/context found. Skipping.', 'warning');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            await utils.loadSettings?.();
            const style = state.settings?.defaultStyle || 'friendly';

            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                postContent: postData.text,
                imageUrls: postData.images,
                style,
                customPrompt: state.settings?.customPrompt || '',
                platform: 'instagram',
                actionType: 'comment'
            });

            if (chrome.runtime.lastError) throw new Error('Extension context invalidated');

            if (!response?.success) {
                if (response?.code === 'AUTH_REQUIRED' || response?.error === 'AUTH_REQUIRED') {
                    utils.showAuthPrompt();
                } else if (response?.code === 'RATE_LIMITED') {
                    utils.showToast('Rate limited. Slow down a bit.', 'warning');
                } else {
                    utils.showToast(response?.error || 'Generation failed', 'error');
                }
                state.isProcessing = false;
                return false;
            }

            const comment = String(response.comment || '').trim();
            if (!comment) {
                utils.showToast('Empty comment received', 'error');
                state.isProcessing = false;
                return false;
            }

            if (utils.isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'updateStats', statType: 'generated', style }).catch(() => { });
            }

            utils.showToast('Opening comment box...', 'info');

            const commentIcon = utils.findCommentIcon?.(post);
            if (!commentIcon) {
                utils.showToast('Comment icon not found', 'error');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            commentIcon.click();

            const input = await utils.waitForStrictInput(6500);
            if (!input) {
                utils.showToast('Comment input did not open', 'error');
                post.dataset.aiCommented = 'skipped';
                state.isProcessing = false;
                return false;
            }

            return await utils.postCommentInModal(comment, startUrl);
        } catch (e) {
            console.error('[Crixen IG] error', e);
            const msg = e?.message || String(e);
            if (/invalidat/i.test(msg)) utils.showToast('Extension updated. Refresh the page.', 'error');
            else utils.showToast(`Error: ${msg}`, 'error');
            state.isProcessing = false;
            return false;
        }
    };
})();