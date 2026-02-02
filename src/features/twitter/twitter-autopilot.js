// SMITH ai - Twitter Autopilot

(function () {
    'use strict';

    window.SmithTwitter = window.SmithTwitter || {};
    const utils = window.SmithTwitter;
    const state = window.SmithTwitter.state;

    window.SmithTwitter.startAutoPilot = function (limit) {
        if (state.isAutoPilot) return;
        state.isAutoPilot = true;
        state.autoLimit = limit || 20;
        state.autoCount = 0;
        utils.showToast(`🚀 X Auto-Pilot Started!`, 'success');
        autoLoop();
    };

    window.SmithTwitter.stopAutoPilot = function () {
        state.isAutoPilot = false;
        utils.showToast('🛑 X Auto-Pilot Stopped', 'warning');
    };

    async function autoLoop() {
        while (state.isAutoPilot && state.autoCount < state.autoLimit) {

            // 1. Find visible tweets
            const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            let target = null;

            for (const t of tweets) {
                if (!t.dataset.smithProcessed && utils.isElementVisible(t)) {
                    // Check if it's an ad?
                    if (t.textContent.includes('Ad')) continue;
                    target = t;
                    break;
                }
            }

            // 2. Scroll if needed
            if (!target) {
                window.scrollBy({ top: 500, behavior: 'smooth' });
                await utils.sleep(2000);
                continue;
            }

            // 3. Highlight
            target.style.borderLeft = '4px solid #1d9bf0';
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await utils.sleep(1000);

            // 4. Process (Reply)
            await window.SmithTwitter.handleReply(target);

            // 5. Mark done
            target.dataset.smithProcessed = 'true';
            target.style.borderLeft = 'none';
            state.autoCount++;

            utils.showToast(`Auto: ${state.autoCount}/${state.autoLimit}`, 'info');

            // 6. Wait
            await utils.sleep(3000 + Math.random() * 4000);
        }

        state.isAutoPilot = false;
        utils.showToast('Task Complete', 'success');
    }

})();
