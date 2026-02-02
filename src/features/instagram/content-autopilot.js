// Instagram AI Comment Assistant - Autonomous Mode

(function () {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};

    // Shortcuts
    const utils = window.InstagramAssistant;
    const state = window.InstagramAssistant.state;

    // --- AUTONOMOUS MODE ---

    window.InstagramAssistant.startAutoPilot = function (limit) {
        if (state.isAutoPilot) return;
        state.isAutoPilot = true;
        state.autoLimit = limit || 20;
        state.autoCount = 0;
        utils.showToast(`🚀 Auto-Pilot Started! Target: ${state.autoLimit} posts`, 'success');
        utils.autoPilotLoop();
    };

    window.InstagramAssistant.stopAutoPilot = function () {
        state.isAutoPilot = false;
        utils.showToast('🛑 Auto-Pilot Stopped', 'warning');
    };

    window.InstagramAssistant.autoPilotLoop = async function () {
        // Broadcast start
        chrome.runtime.sendMessage({ action: 'autoProgress', isRunning: true, count: state.autoCount, limit: state.autoLimit }).catch(() => { });

        while (state.isAutoPilot && state.autoCount < state.autoLimit) {
            // 1. Find target post
            const posts = Array.from(document.querySelectorAll('article'));
            let targetPost = null;

            // Find first visible post that hasn't been commented
            for (const post of posts) {
                if (!post.dataset.aiCommented && utils.isElementVisible(post)) {
                    targetPost = post;
                    break;
                }
            }

            // If no visible target, try scrolling to next unprocessed
            if (!targetPost) {
                console.log('AI Auto: No visible target, searching...');
                for (const post of posts) {
                    if (!post.dataset.aiCommented) {
                        targetPost = post;
                        // Scroll it into view
                        post.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        if (!(await utils.sleepWithCheck(2000))) break; // Wait for scroll
                        break;
                    }
                }
            }

            // If still no target, just scroll down blindly
            if (!targetPost) {
                console.log('AI Auto: Scrolling down for new posts...');
                window.scrollBy({ top: 800, behavior: 'smooth' });
                if (!(await utils.sleepWithCheck(3000))) break;
                continue; // Retry loop
            }

            // 2. Process Target
            console.log(`AI Auto: Processing post ${state.autoCount + 1}/${state.autoLimit}`);

            // Highlight for user
            targetPost.style.border = '2px solid #3b82f6';

            // Generate
            utils.handleGenerateClick(targetPost);

            // Wait for processing to start
            if (!(await utils.sleepWithCheck(1000))) break;

            // Wait for processing to finish
            const maxWait = 45000; // 45s max per post
            let waited = 0;
            while (state.isProcessing && waited < maxWait && state.isAutoPilot) {
                if (!(await utils.sleepWithCheck(1000))) break;
                waited += 1000;
            }

            // Remove highlight
            targetPost.style.border = 'none';

            if (!state.isAutoPilot) break;

            // Check if successful
            if (targetPost.dataset.aiCommented === 'true') {
                state.autoCount++;
                utils.showToast(`Auto-Pilot: ${state.autoCount}/${state.autoLimit} posted`, 'success');
                // Broadcast Progress
                chrome.runtime.sendMessage({ action: 'autoProgress', isRunning: true, count: state.autoCount, limit: state.autoLimit }).catch(() => { });
            } else {
                console.warn('AI Auto: Post failed or skipped');
                // Mark as skipped so we don't retry forever
                targetPost.dataset.aiCommented = 'skipped';
            }

            // 3. Random Delay (Human-like)
            if (state.autoCount < state.autoLimit) {
                const delay = 4000 + Math.random() * 5000; // 4-9s
                console.log(`AI Auto: Waiting ${Math.round(delay / 1000)}s...`);
                if (!(await utils.sleepWithCheck(delay))) break;
            }
        }

        state.isAutoPilot = false;
        utils.showToast(state.autoCount >= state.autoLimit ? '🎉 Task Complete!' : '🛑 Stopped', state.autoCount >= state.autoLimit ? 'success' : 'warning');

        // Broadcast Finished
        chrome.runtime.sendMessage({ action: 'autoProgress', isRunning: false, count: state.autoCount, limit: state.autoLimit }).catch(() => { });
    };

    // Helper: Sleep that listens for Stop signal
    window.InstagramAssistant.sleepWithCheck = async function (ms) {
        const step = 100;
        let counted = 0;
        while (counted < ms) {
            if (!state.isAutoPilot) return false;
            await utils.sleep(step);
            counted += step;
        }
        return state.isAutoPilot;
    };

})();
