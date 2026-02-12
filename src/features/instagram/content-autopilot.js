// Instagram AI Comment Assistant - AutoPilot (Prod Grade)

(() => {
    'use strict';

    window.InstagramAssistant = window.InstagramAssistant || {};
    const utils = window.InstagramAssistant;
    const state = window.InstagramAssistant.state;

    function broadcast() {
        if (!utils.isExtensionValid()) return;
        chrome.runtime
            .sendMessage({
                action: 'autoProgress',
                isRunning: state.isAutoPilot,
                count: state.autoCount,
                limit: state.autoLimit,
                phase: state.autoPhase || 'idle'
            })
            .catch(() => { });
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

        utils.showToast(`Auto-Pilot started: ${state.autoLimit} posts`, 'success');
        broadcast();

        try {
            await utils.autoPilotLoop(state.autoAbortController.signal);
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
        utils.showToast('Auto-Pilot stopped', 'warning');
        broadcast();
    };

    utils.autoPilotLoop = async function (signal) {
        state.autoPhase = 'running';
        broadcast();

        while (!signal.aborted && state.isAutoPilot && state.autoCount < state.autoLimit) {
            // 1) Find target
            state.autoPhase = 'finding_post';
            broadcast();

            let target = utils.pickBestVisiblePost?.();

            if (!target) {
                state.autoPhase = 'scrolling';
                broadcast();
                window.scrollBy({ top: 900, behavior: 'smooth' });
                if (!(await humanDelay(2200, 3200, signal))) break;
                continue;
            }

            if (target.dataset.aiCommented === 'true') {
                continue;
            }

            // 2) Position it
            state.autoPhase = 'positioning';
            broadcast();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (!(await humanDelay(900, 1400, signal))) break;

            // 3) Process (IMPORTANT: await)
            state.autoPhase = 'generating_and_posting';
            broadcast();

            target.style.outline = '2px solid #3b82f6';
            target.style.outlineOffset = '4px';

            const ok = await utils.handleGenerateClick(target);

            target.style.outline = '';
            target.style.outlineOffset = '';

            if (signal.aborted || !state.isAutoPilot) break;

            if (ok && target.dataset.aiCommented === 'true') {
                state.autoCount += 1;
                state.autoPhase = 'posted';
                utils.showToast(`Auto-Pilot: ${state.autoCount}/${state.autoLimit}`, 'success');
                broadcast();
            } else {
                target.dataset.aiCommented = target.dataset.aiCommented || 'skipped';
                state.autoPhase = 'skipped';
                broadcast();
            }

            if (state.autoCount >= state.autoLimit) break;

            // 4) Cooldown (human-like)
            state.autoPhase = 'cooldown';
            broadcast();
            if (!(await humanDelay(4500, 9000, signal))) break;
        }

        if (!signal.aborted && state.autoCount >= state.autoLimit) {
            utils.showToast('Task complete', 'success');
        } else if (signal.aborted || !state.isAutoPilot) {
            utils.showToast('Stopped', 'warning');
        }
    };
})();