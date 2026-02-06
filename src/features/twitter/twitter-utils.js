// Crixen - Twitter Utilities

(function () {
    'use strict';

    // Initialize Global Namespace
    window.CrixenTwitter = window.CrixenTwitter || {};

    // Shared State
    window.CrixenTwitter.state = {
        currentTweet: null,
        settings: null,
        isProcessing: false,
        isAutoPilot: false,
        autoLimit: 20,
        autoCount: 0
    };

    // --- UTILITIES ---

    window.CrixenTwitter.isExtensionValid = function () {
        try {
            chrome.runtime.id;
            return true;
        } catch {
            return false;
        }
    };

    window.CrixenTwitter.loadSettings = async function () {
        if (!window.CrixenTwitter.isExtensionValid()) return;
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(); return;
                    }
                    window.CrixenTwitter.state.settings = response?.settings || { defaultStyle: 'witty' };
                    resolve();
                });
            } catch (e) { resolve(); }
        });
    };

    window.CrixenTwitter.showToast = function (message, type = 'info') {
        const existing = document.querySelectorAll('.crixen-toast-message');
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-toast-message';
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = type === 'error' ? '#ff3b30' : (type === 'success' ? '#34c759' : '#1d9bf0'); // Twitter Blue
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '24px';
        toast.style.zIndex = '10000';
        toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '700';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    window.CrixenTwitter.showAuthPrompt = function () {
        const existing = document.querySelectorAll('.crixen-auth-prompt');
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = 'crixen-auth-prompt';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>🔒 Login required to use Crixen</span>
                <button id="crixen-twitter-login-btn" style="
                    background: white; 
                    color: #1d9bf0; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 12px; 
                    font-weight: 700; 
                    cursor: pointer;
                    font-size: 13px;
                ">Login</button>
            </div>
        `;

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1d9bf0',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '24px',
            zIndex: '10000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        const btn = document.getElementById('crixen-twitter-login-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                window.open('https://crixen.xyz', '_blank');
                toast.remove();
            });
        }

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        });

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    };

    window.CrixenTwitter.sleep = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    window.CrixenTwitter.isElementVisible = function (el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return true;
    };

})();
