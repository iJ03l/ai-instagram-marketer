// Crixen - Twitter Autopilot (Prod Grade)

(() => {
    'use strict';

    window.CrixenTwitter = window.CrixenTwitter || {};
    const utils = window.CrixenTwitter;
    const state = window.CrixenTwitter.state;

    function broadcast() {
        if (!utils.isExtensionValid()) return;
        chrome.runtime.sendMessage({
            action: 'autoProgress',
            isRunning: state.isAutoPilot,
            count: state.autoCount,
            limit: state.autoLimit,
            phase: state.autoPhase || 'idle'
        }).catch(() => { });
    }

    async function humanDelay(minMs, maxMs, signal) {
        const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
        const start = Date.now();
        while (Date.now() - start < ms) {
            if (signal?.aborted) return false;
            await utils.sleep(120);
        }
        return !signal?.aborted;
    }

    utils.startAutoPilot = async function (limit) {
        if (state.isAutoPilot) return;

        state.isAutoPilot = true;
        state.autoLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 20;
        state.autoCount = 0;
        state.autoPhase = 'starting';
        state.autoAbortController = new AbortController();

        utils.showToast('X Auto-Pilot started', 'success');
        broadcast();

        try {
            await autoLoop(state.autoAbortController.signal);
        } finally {
            state.isAutoPilot = false;
            state.autoPhase = 'idle';
            state.autoAbortController = null;
            broadcast();
        }
    };

    utils.stopAutoPilot = function () {
        state.isAutoPilot = false;
        state.autoPhase = 'stopping';
        state.autoAbortController?.abort?.();
        utils.showToast('X Auto-Pilot stopped', 'warning');
        broadcast();
    };

    async function autoLoop(signal) {
        while (!signal.aborted && state.isAutoPilot && state.autoCount < state.autoLimit) {
            state.autoPhase = 'finding';
            broadcast();

            const target = utils.pickBestVisibleTweet();
            if (!target) {
                state.autoPhase = 'scrolling';
                broadcast();
                window.scrollBy({ top: 900, behavior: 'smooth' });
                if (!(await humanDelay(1600, 2600, signal))) break;
                continue;
            }

            // Move into view
            state.autoPhase = 'positioning';
            broadcast();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (!(await humanDelay(700, 1100, signal))) break;

            // Attempt reply (1 retry max)
            state.autoPhase = 'replying';
            broadcast();

            target.style.outline = '2px solid #1d9bf0';
            target.style.outlineOffset = '4px';

            let ok = await utils.handleReply(target);
            if (!ok && !signal.aborted) {
                // Retry once after small delay (often modal glitches)
                await humanDelay(900, 1400, signal);
                ok = await utils.handleReply(target);
            }

            target.style.outline = '';
            target.style.outlineOffset = '';

            if (signal.aborted || !state.isAutoPilot) break;

            if (ok) {
                target.dataset.crixenAutopilot = 'done';
                state.autoCount += 1;
                utils.showToast(`Auto: ${state.autoCount}/${state.autoLimit}`, 'info');
            } else {
                target.dataset.crixenAutopilot = 'skipped';
            }

            state.autoPhase = 'cooldown';
            broadcast();
            if (!(await humanDelay(3200, 6200, signal))) break;
        }

        if (!signal.aborted && state.autoCount >= state.autoLimit) utils.showToast('Task complete', 'success');
    }

})();