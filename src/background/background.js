import { CONFIG } from '../config.js';

// ============================================================================
// CRIXEN - Industry Standard Social Media AI Agent (Hardened)
// Background Service Worker
// ============================================================================

const NEAR_AI_ENDPOINT = CONFIG.NEAR_AI_ENDPOINT;
const API_TIMEOUT = 60000;

// ====== Robustness knobs ======
const RETRY = {
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 6000,
    jitterRatio: 0.25
};

const RATE_LIMIT = {
    windowMs: 10_000,
    maxInWindow: 6
};

const CACHE = {
    ttlMs: 20_000,
    maxEntries: 200
};

// ====== In-memory state ======
const mem = {
    rate: new Map(),
    cache: new Map(),
    inflight: new Map()
};

// =============================================================================
// PLATFORM CONTEXT SYSTEM
// =============================================================================

const PLATFORM_CONTEXT = {
    twitter: {
        name: 'Twitter/X',
        culture: 'Fast, witty, punchy. Value brevity, hot takes, and sharp observations. Threads for deeper content.',
        actionTypes: {
            reply: {
                goal: 'Add value to the conversation. Be quotable.',
                rules: [
                    'Start strong - the first line must hook',
                    'One clear idea or take per reply',
                    'Questions and contrarian takes perform well',
                    'Agree/disagree + WHY is better than just agreeing'
                ]
            },
            quote: {
                goal: 'Add your unique perspective, insight, or humor to amplify the original.',
                rules: [
                    'Your quote adds value the original lacked',
                    'Hot takes, humor, or deep insight work best',
                    'Dont just praise - add substance'
                ]
            },
            post: {
                goal: 'Create standalone content that stops the scroll.',
                rules: [
                    'EXPAND on the input topic/vibe into a full thought, story, or observation.',
                    'If the input is a question, use it as a prompt for a post, do NOT answer it directly like a chatbot.',
                    'First line is everything - make them stop scrolling',
                    'One big idea per post',
                    'End with a hook, or call to engage',
                    'Be opinionated, not neutral'
                ]
            },
            thread: {
                goal: 'Write a multi-tweet thread that teaches or persuades. Each tweet earns the next.',
                rules: [
                    'Tweet 1 is a hook. Make it punchy.',
                    'Each tweet is a standalone thought that flows to the next.',
                    'No filler like "a thread" unless it fits the voice.',
                    'No unrelated questions. Only ask a question if it directly advances the topic.',
                    'Avoid generic motivation. Use specifics, examples, frameworks.',
                    'Keep each tweet under 260 characters (safe buffer).',
                    'Total length: 5–9 tweets unless user asks otherwise.'
                ]
            },
            longform: {
                goal: 'Write a longer single post that reads like a mini-essay but still fits X culture.',
                rules: [
                    'Open with a strong first line.',
                    'Use short paragraphs and DOUBLE line breaks.',
                    'No unrelated questions. One optional closing question allowed only if it matches the topic.',
                    'No lists unless they materially improve clarity.',
                    'CRITICAL: Must be at least 150 words (approx 900-1200 chars). Do NOT write short tweets.',
                    'CRITICAL: If the user input is a specific phrase (e.g. "gm"), START with that phrase and expand.'
                ]
            }
        }
    },
    instagram: {
        name: 'Instagram',
        culture: 'Aspirational, community-driven. Comments build real relationships. Authenticity wins.',
        actionTypes: {
            comment: {
                goal: 'Build genuine connection. Comments here matter for relationships.',
                rules: [
                    'Never respond out of context of the caption',
                    'Be conversational and warm - this is a community',
                    'Emojis are expected and add personality',
                    'Ask questions to spark conversation',
                    'Personal connection >>> generic praise'
                ]
            }
        }
    }
};

const AI_MODELS = {
    deepseek: {
        name: 'DeepSeek V3.1',
        model: 'deepseek-ai/DeepSeek-V3.1',
        description: 'Fast and efficient',
        vision: false
    },
    openai: {
        name: 'OpenAI GPT-5.2',
        model: 'openai/gpt-5.2',
        description: 'Premium quality',
        vision: true
    },
    claude: {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4-5',
        description: 'Nuanced and thoughtful',
        vision: true
    }
};

const COMMENT_STYLES = {
    friendly: {
        name: 'Friendly',
        prompt: 'Warm, supportive, genuine energy. Use 1-2 relevant emojis naturally. Be the person everyone wants to talk to.'
    },
    professional: {
        name: 'Professional',
        prompt: 'Polished, business-appropriate, thoughtful. Show expertise. Minimal emojis. Think "respected industry voice."'
    },
    casual: {
        name: 'Casual',
        prompt: 'Relaxed, conversational, like texting a friend. Natural language, occasional slang, authentic vibe.'
    },
    playful: {
        name: 'Playful',
        prompt: 'Fun, lighthearted, cheeky energy. Use humor, be a little bold. Match the vibe and add to it.'
    },
    'radically-honest': {
        name: 'Radically Honest',
        prompt: 'Blunt, direct, no fluff. Call it exactly how you see it. Respect through honesty, not flattery.'
    },
    supportive: {
        name: 'Supportive',
        prompt: 'Deeply encouraging, validate their experience. Acknowledge the struggle or celebrate the win genuinely.'
    },
    enthusiastic: {
        name: 'Enthusiastic',
        prompt: 'High energy, genuinely excited! Let the enthusiasm show naturally. Emojis welcome when authentic.'
    },
    witty: {
        name: 'Witty',
        prompt: 'Clever, sharp, subtle humor. Smart observations, not mean. The kind of comment people screenshot.'
    }
};

// =============================================================================
// Utility: typed errors
// =============================================================================

class CrixenError extends Error {
    constructor(code, message, meta = {}) {
        super(message);
        this.name = 'CrixenError';
        this.code = code;
        this.meta = meta;
    }
}

const ERR = {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    RATE_LIMITED: 'RATE_LIMITED',
    BAD_INPUT: 'BAD_INPUT',
    API_ERROR: 'API_ERROR',
    TIMEOUT: 'TIMEOUT',
    NETWORK: 'NETWORK',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE'
};

// =============================================================================
// Storage helpers
// =============================================================================

function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

async function getSettings() {
    const { settings } = await storageGet('settings');
    return settings || {
        selectedModel: 'deepseek',
        apiKey: '',
        defaultStyle: 'friendly',
        customPrompt: '',
        instructions: '',
        capturedStrategies: []
    };
}

async function getStats() {
    const { stats } = await storageGet('stats');
    return stats || { generated: 0, posted: 0, byStyle: {} };
}

async function updateStats(statType, style) {
    const stats = await getStats();
    if (statType === 'generated') {
        stats.generated = (stats.generated || 0) + 1;
        if (style) {
            stats.byStyle = stats.byStyle || {};
            stats.byStyle[style] = (stats.byStyle[style] || 0) + 1;
        }
    } else if (statType === 'posted') {
        stats.posted = (stats.posted || 0) + 1;
    }
    await storageSet({ stats });
}

// =============================================================================
// Initialize defaults
// =============================================================================

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings', 'stats'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    selectedModel: 'deepseek',
                    apiKey: '',
                    defaultStyle: 'friendly',
                    customPrompt: '',
                    instructions: '',
                    capturedStrategies: []
                }
            });
        }
        if (!result.stats) {
            chrome.storage.local.set({
                stats: { generated: 0, posted: 0, byStyle: {} }
            });
        }
    });
});

// =============================================================================
// Message handler
// =============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            if (!request || typeof request !== 'object') {
                throw new CrixenError(ERR.BAD_INPUT, 'Invalid request');
            }

            switch (request.action) {
                case 'auth:login':
                    await handleLogin(request.token, request.user, request.expiresAt);
                    sendResponse({ success: true });
                    break;

                case 'auth:logout':
                    await handleLogout();
                    sendResponse({ success: true });
                    break;

                case 'auth:refresh':
                    await handleTokenRefresh(request.token, request.expiresAt);
                    sendResponse({ success: true });
                    break;

                case 'ping':
                    sendResponse({ alive: true });
                    break;

                case 'auth:getStatus':
                    sendResponse(await getAuthStatus());
                    break;

                case 'generateComment': {
                    const comment = await generateComment(
                        request.postContent,
                        request.style,
                        request.customPrompt,
                        request.imageUrls,
                        request.platform || 'instagram',
                        request.actionType || null
                    );
                    sendResponse({ success: true, comment });
                    break;
                }

                case 'generatePost': {
                    const post = await generatePost(
                        request.topic,
                        request.platform || 'twitter',
                        request.actionType || 'post'
                    );
                    sendResponse({ success: true, comment: post });
                    break;
                }

                case 'getSettings': {
                    const settings = await getSettings();
                    sendResponse({ settings, models: AI_MODELS, styles: COMMENT_STYLES });
                    break;
                }

                case 'saveSettings':
                    await storageSet({ settings: request.settings });
                    sendResponse({ success: true });
                    break;

                case 'getStats':
                    sendResponse({ stats: await getStats() });
                    break;

                case 'updateStats':
                    await updateStats(request.statType, request.style);
                    sendResponse({ success: true });
                    break;

                case 'testConnection':
                    sendResponse(await testApiConnection(request.apiKey));
                    break;

                case 'saveStrategies':
                    await updateStrategies(request.strategies);
                    sendResponse({ success: true });
                    break;

                case 'generateStrategyDoc': {
                    const doc = await generateStrategyDoc(request.additionalContext);
                    sendResponse({ success: true, doc });
                    break;
                }

                case 'generateSmartReport': {
                    const doc = await generateSmartReport(request.stats || {});
                    sendResponse({ success: true, doc });
                    break;
                }

                case 'generateToolkit': {
                    const doc = await generateToolkitDoc(request.toolType, request.additionalContext);
                    sendResponse({ success: true, doc });
                    break;
                }

                case 'loginSync':
                    console.warn('[Background] Legacy loginSync called.');
                    if (request.token) {
                        await handleLogin(request.token, request.user);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'No token' });
                    }
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            const normalized = normalizeError(error);
            console.error('Background error:', normalized);
            sendResponse({
                success: false,
                error: normalized.message,
                code: normalized.code,
                meta: normalized.meta
            });
        }
    })();

    return true;
});

// =============================================================================
// AUTH HANDLERS
// =============================================================================

async function handleLogin(token, user, expiresAt) {
    if (!token || typeof token !== 'string') {
        throw new CrixenError(ERR.BAD_INPUT, 'Invalid token');
    }

    await storageSet({
        crixen_auth: {
            token,
            user: user || null,
            expiresAt: expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
            lastSync: Date.now()
        },
        token,
        activeProjectId: 'default'
    });

    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

    broadcastAuthChange('login', user || null);
}

async function handleLogout() {
    await storageRemove(['crixen_auth', 'token', 'activeProjectId', 'strategyCID', 'strategyLastSync']);
    chrome.action.setBadgeText({ text: '' });
    broadcastAuthChange('logout', null);
}

async function handleTokenRefresh(newToken, newExpiresAt) {
    if (!newToken || typeof newToken !== 'string') return;

    const { crixen_auth } = await storageGet('crixen_auth');
    if (!crixen_auth) return;

    crixen_auth.token = newToken;
    crixen_auth.expiresAt = newExpiresAt || crixen_auth.expiresAt;
    crixen_auth.lastSync = Date.now();

    await storageSet({ crixen_auth, token: newToken });
}

async function getAuthStatus() {
    const { crixen_auth } = await storageGet('crixen_auth');
    if (!crixen_auth) return { authenticated: false };

    const isExpired = (crixen_auth.expiresAt || 0) < Date.now();
    const timeLeft = (crixen_auth.expiresAt || 0) - Date.now();

    return {
        authenticated: !isExpired,
        user: crixen_auth.user || null,
        expiresAt: crixen_auth.expiresAt || 0,
        needsRefresh: !isExpired && timeLeft < 24 * 60 * 60 * 1000
    };
}

function broadcastAuthChange(type, user) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (!tab?.id) return;
            chrome.tabs.sendMessage(tab.id, {
                type: 'CRIXEN_AUTH_CHANGED',
                authType: type,
                user
            }).catch(() => { });
        });
    });
}

chrome.alarms.create('tokenRefreshCheck', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'tokenRefreshCheck') return;

    const status = await getAuthStatus();
    if (!(status.authenticated && status.needsRefresh)) return;

    const tabs = await chrome.tabs.query({
        url: [
            'https://crixen.xyz/*',
            'https://www.crixen.xyz/*',
            'http://localhost:5173/*',
            'http://127.0.0.1:5173/*'
        ]
    });

    if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CRIXEN_REQUEST_TOKEN_REFRESH' }).catch(() => { });
    }
});

// =============================================================================
// Networking
// =============================================================================

async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') throw new CrixenError(ERR.TIMEOUT, 'Request timed out');
        throw new CrixenError(ERR.NETWORK, err?.message || 'Network error');
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function backoffDelay(attempt) {
    const exp = Math.min(RETRY.maxDelayMs, RETRY.baseDelayMs * Math.pow(2, attempt - 1));
    const jitter = exp * RETRY.jitterRatio * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(exp + jitter));
}

async function fetchWithRetry(url, options, timeout, shouldRetryFn) {
    let lastErr;
    for (let attempt = 1; attempt <= RETRY.maxAttempts; attempt++) {
        try {
            const res = await fetchWithTimeout(url, options, timeout);
            if (shouldRetryFn && shouldRetryFn(res) && attempt < RETRY.maxAttempts) {
                await sleep(backoffDelay(attempt));
                continue;
            }
            return res;
        } catch (err) {
            lastErr = err;
            if (attempt < RETRY.maxAttempts) {
                await sleep(backoffDelay(attempt));
                continue;
            }
        }
    }
    throw lastErr || new CrixenError(ERR.NETWORK, 'Request failed');
}

function normalizeError(error) {
    if (error instanceof CrixenError) return error;
    return new CrixenError('UNKNOWN', error?.message || 'Unknown error', { raw: String(error) });
}

// =============================================================================
// Rate limiting + cache + inflight
// =============================================================================

function rateCheck(key) {
    const now = Date.now();
    const entry = mem.rate.get(key);
    if (!entry || now - entry.start > RATE_LIMIT.windowMs) {
        mem.rate.set(key, { start: now, count: 1 });
        return;
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT.maxInWindow) {
        throw new CrixenError(ERR.RATE_LIMITED, 'Too many requests. Please wait a moment.');
    }
}

function cacheGet(key) {
    const entry = mem.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE.ttlMs) {
        mem.cache.delete(key);
        return null;
    }
    return entry.value;
}

function cacheSet(key, value) {
    mem.cache.set(key, { at: Date.now(), value });
    if (mem.cache.size > CACHE.maxEntries) {
        const firstKey = mem.cache.keys().next().value;
        if (firstKey) mem.cache.delete(firstKey);
    }
}

function stableHash(obj) {
    const seen = new WeakSet();
    const s = JSON.stringify(obj, (k, v) => {
        if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return;
            seen.add(v);
            if (!Array.isArray(v)) {
                return Object.keys(v).sort().reduce((acc, key) => {
                    acc[key] = v[key];
                    return acc;
                }, {});
            }
        }
        return v;
    });
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16);
}

// =============================================================================
// Prompting
// =============================================================================

const BANNED_PHRASES = [
    'Great post!', 'Love this!', 'This is amazing!', 'So true!', 'Absolutely!',
    'This resonates', 'Well said!', "Couldn't agree more!", 'This is fire!', 'Facts!',
    'Appreciate you sharing', 'Thanks for sharing', 'Really needed to hear this',
    'This hit different', 'As someone who', 'I absolutely love', 'Awesome',
    'Nice one', 'Good stuff', 'Keep it up'
];

function buildSystemPrompt({ platform, actionType, settings, styleKey, customPrompt }) {
    const platformCtx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.instagram;
    const actionCtx = platformCtx?.actionTypes?.[actionType];

    let stylePrompt = '';
    if (styleKey === 'custom' && customPrompt) {
        stylePrompt = String(customPrompt);
    } else if (typeof styleKey === 'string' && styleKey.startsWith('custom:')) {
        const strategyName = styleKey.split(':')[1];
        const strategy = (settings.capturedStrategies || []).find((s) => s.name === strategyName);
        stylePrompt = strategy?.prompt || COMMENT_STYLES.friendly.prompt;
    } else {
        stylePrompt = COMMENT_STYLES[styleKey]?.prompt || COMMENT_STYLES.friendly.prompt;
    }

    const brandVoice = settings.instructions ? String(settings.instructions) : '';

    let prompt = `# IDENTITY & ROLE

You ARE the user. You are writing content AS them, not for them.
You are their voice on ${platformCtx?.name || 'social media'}.
Never write like an assistant or helper. Never say "I'll help you" or "Here's a response."
Just BE them and write the ${actionType}.`;

    if (brandVoice) {
        prompt += `

## YOUR BRAND VOICE (CRITICAL - DO NOT DEVIATE)

${brandVoice}

DEFAULT TO THIS VOICE OVER EVERYTHING ELSE.`;
    }

    prompt += `

## YOUR TONE FOR THIS ${String(actionType).toUpperCase()}

${stylePrompt}

## PLATFORM: ${platformCtx.name}

Cultural Context: ${platformCtx.culture}`;

    if (actionCtx) {
        prompt += `

## ${String(actionType).toUpperCase()} RULES

Goal: ${actionCtx.goal}

${actionCtx.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`;
    }

    prompt += `

# STRICT QUALITY RULES (NON-NEGOTIABLE)

1. Specific NOT Generic: Reference SPECIFIC details from the caption or text.
   - If you cannot find something specific to comment on, output exactly: NO_VALID_COMMENT

2. Banned Phrases - NEVER use these:
${BANNED_PHRASES.map((p) => `   - "${p}"`).join('\n')}

2. Formatting:
   - Use DOUBLE LINE BREAKS between paragraphs or thoughts
   - NO em dashes, en dashes, or double hyphens
   - Maximum 1 emoji, only if natural for your persona
   - Length: 1-3 sentences max (unless specific format instructions say otherwise).

3. Authenticity: Write like a real person with opinions, not a bot.

4. Value-Add: Every ${actionType} must add value.

5. SPECIFICITY (CRITICAL):
   - Reference specific details from the context.
   - If the context is too short or vague, write a thoughtful, high-level response that fits the vibe.
   - Only output NO_VALID_COMMENT if the input is truly incomprehensible.

6. No Unrelated Questions:
   - Do not ask a question unless it is directly tied to the topic/vibe.
   - Never tack on a generic engagement question.

## SEED HANDLING (CRITICAL)

If the user input is a short seed like "GM", "gm", "GN", "gn", "lol", "wow", or a specific phrase:
- START the output with that exact seed (case preserved).
- Expand it into a real post with a clear vibe/topic implied by the seed.
- Do NOT say "Here is a draft".
- Do NOT act like a chatbot answering the seed.
- Example: Topic "GM" -> Output: "GM\n\nReally feeling the energy of this building community today..." (Full post)`;

    return prompt;
}

function postProcessContent(content, platform) {
    if (!content) return '';

    let cleaned = String(content).trim()
        .replace(/—/g, ' ')
        .replace(/–/g, ' ')
        .replace(/--/g, ' ')
        .replace(/[ \t]+/g, ' ');

    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n+/g, '\n\n');

    if (platform === 'twitter') {
        const hashtagMatches = cleaned.match(/#\w+/g) || [];
        if (hashtagMatches.length > 2) {
            hashtagMatches.slice(2).forEach((tag) => {
                cleaned = cleaned.replace(new RegExp(`\\s*${escapeRegExp(tag)}`, 'g'), '');
            });
        }
    }

    if (cleaned === 'NO_VALID_COMMENT') return '';

    for (const phrase of BANNED_PHRASES) {
        if (cleaned.toLowerCase().includes(phrase.toLowerCase())) {
            console.warn(`[PostProcess] Content contains banned phrase: "${phrase}"`);
            break;
        }
    }

    return cleaned;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertString(name, val, { min = 1, max = 20_000 } = {}) {
    if (typeof val !== 'string') throw new CrixenError(ERR.BAD_INPUT, `${name} must be a string`);
    const t = val.trim();
    if (t.length < min) throw new CrixenError(ERR.BAD_INPUT, `${name} is empty`);
    if (t.length > max) throw new CrixenError(ERR.BAD_INPUT, `${name} too long`);
    return t;
}

function ensurePlatform(platform) {
    return platform === 'twitter' || platform === 'instagram' ? platform : 'instagram';
}

function ensureActionType(platform, actionType) {
    if (actionType && typeof actionType === 'string') return actionType;
    return platform === 'twitter' ? 'reply' : 'comment';
}

// =============================================================================
// Core Generation
// =============================================================================

async function requireAuthToken() {
    const { token, activeProjectId } = await storageGet(['token', 'activeProjectId']);
    if (!token) throw new CrixenError(ERR.AUTH_REQUIRED, 'Authentication required');
    return { token, projectId: activeProjectId || 'default' };
}

function shouldRetryResponse(res) {
    return [408, 425, 429, 500, 502, 503, 504].includes(res.status);
}

async function callCrixenGenerate({ token, payload }) {
    console.log('[API] Calling backend with payload:', {
        projectId: payload.projectId,
        maxTokens: payload.maxTokens,
        promptLength: payload.prompt?.length,
        contextLength: payload.context?.length
    });

    const response = await fetchWithRetry(
        CONFIG.API_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        },
        API_TIMEOUT,
        shouldRetryResponse
    );

    if (response.status === 401) throw new CrixenError(ERR.AUTH_REQUIRED, 'Authentication required');

    if (!response.ok) {
        let body = '';
        try {
            body = await response.text();
        } catch { }
        throw new CrixenError(ERR.API_ERROR, `AI Error ${response.status}`, { body });
    }

    let data;
    try {
        data = await response.json();
    } catch (e) {
        throw new CrixenError(ERR.API_ERROR, 'Invalid JSON response from API');
    }

    const content = data?.content || data?.choices?.[0]?.message?.content || '';
    if (!content || !String(content).trim()) {
        throw new CrixenError(ERR.EMPTY_RESPONSE, 'Empty AI response');
    }

    console.log('[API] Received content length:', String(content).length);
    return String(content);
}

async function generateComment(
    postContent,
    style,
    customPrompt = '',
    _ignoredImages = [],
    platform = 'instagram',
    actionType = null
) {
    rateCheck('generateComment');

    const p = ensurePlatform(platform);
    const a = ensureActionType(p, actionType);

    const context = assertString('postContent', postContent, { min: 3, max: 25_000 });
    const styleKey = typeof style === 'string' && style.trim() ? style.trim() : 'friendly';

    const settings = await getSettings();

    const systemPrompt = buildSystemPrompt({
        platform: p,
        actionType: a,
        settings,
        styleKey,
        customPrompt: typeof customPrompt === 'string' ? customPrompt : ''
    });

    const enhancedPrompt = `${systemPrompt}

# CONTEXT TO COMMENT ON

"${context}"

# COMMENT INSTRUCTIONS
- Write a short, engaging ${a} AS the user.
- Embody the ${styleKey} style.
- NO preamble (No "I'll help you", no "Here is a response").
- Focus on the vibes and specifics in the context above.
- Ensure the output is a direct ${a} ready to post.`;

    const { token, projectId } = await requireAuthToken();

    const payload = {
        projectId,
        prompt: enhancedPrompt,
        context
    };

    const dedupeKey = `genComment:${stableHash({ p, a, styleKey, systemPrompt, context, projectId })}`;

    const cached = cacheGet(dedupeKey);
    if (cached !== null) return cached;

    if (mem.inflight.has(dedupeKey)) return mem.inflight.get(dedupeKey);

    const promise = (async () => {
        const raw = await callCrixenGenerate({ token, payload });
        const cleaned = postProcessContent(raw, p);
        cacheSet(dedupeKey, cleaned);
        return cleaned;
    })().finally(() => {
        mem.inflight.delete(dedupeKey);
    });

    mem.inflight.set(dedupeKey, promise);
    return promise;
}

// ✅ FIXED: generatePost with maxTokens and explicit formatting
async function generatePost(topic, platform = 'twitter', actionType = 'post') {
    rateCheck('generatePost');

    const p = ensurePlatform(platform);
    const t = assertString('topic', topic, { min: 2, max: 10_000 });

    const settings = await getSettings();
    const { token, projectId } = await requireAuthToken();

    const styleKey = settings.defaultStyle || 'professional';

    const systemPrompt = buildSystemPrompt({
        platform: p,
        actionType,
        settings,
        styleKey,
        customPrompt: settings.customPrompt || ''
    });

    // ✅ Determine maxTokens based on action type
    let maxTokens = 300;
    if (actionType === 'thread') {
        maxTokens = 2500; // 5-9 tweets
    } else if (actionType === 'longform') {
        maxTokens = 1800; // 150+ words
    }

    // ✅ Action-specific formatting instructions
    let formatInstructions = '';

    if (actionType === 'thread') {
        formatInstructions = `
CRITICAL THREAD FORMAT:
- Output EXACTLY 5-9 tweets
- Separate each tweet with a DOUBLE LINE BREAK (two newlines: \\n\\n)
- Each tweet MUST be under 260 characters
- DO NOT number the tweets (no "1/9", no "Tweet 1:")
- DO NOT add any preamble like "Here's a thread:"
- If user input is a seed like "GM", the FIRST tweet must start with "GM"

Example format:
GM builders

This is why I love waking up early...

[blank line]

Most people think productivity is about doing more

But it's actually about doing less, better

[blank line]

Here's what changed for me...

[etc - continue for 5-9 tweets total]`;
    } else if (actionType === 'longform') {
        formatInstructions = `
CRITICAL LONGFORM FORMAT:
- Output a SINGLE long post (minimum 150 words / 900 characters)
- Use DOUBLE LINE BREAKS between paragraphs for readability
- DO NOT break into multiple tweets
- DO NOT number anything
- If user input is a seed phrase, START with it exactly
- This should read like a mini-essay or newsletter excerpt

Example format:
GM

[long paragraph expanding on the morning vibe and a real topic]

[blank line]

[another paragraph diving deeper]

[blank line]

[final insight or call to reflect]`;
    } else {
        formatInstructions = `
POST INSTRUCTIONS:
- Write a complete standalone post AS the user.
- If the input is a short seed (e.g., "GM", "GN", "lol"), START your output with that EXACT phrase, then expand it.
- NO preamble (No "Drafting post...", no "Here is your post").
- NO chatbot answering (Don't say "The best way to scale is...", instead write "Scaling is always about...")
- First line must hook.
- End with engagement or insight.
- Minimum 40 words / 200 characters to avoid being too short.`;
    }

    const enhancedPrompt = `${systemPrompt}

# USER INPUT TO EXPAND

The user provided: "${t}"

${formatInstructions}

ACTION TYPE: ${actionType}

Now write the ${actionType} AS the user. Output ONLY the ${actionType} content, nothing else.`;

    const payload = {
        projectId,
        prompt: enhancedPrompt,
        context: t,
        maxTokens // ✅ Pass dynamic token limit to backend
    };

    const dedupeKey = `genPost:${stableHash({ p, actionType, styleKey, enhancedPrompt, t, projectId, maxTokens })}`;

    const cached = cacheGet(dedupeKey);
    if (cached !== null) return cached;

    if (mem.inflight.has(dedupeKey)) return mem.inflight.get(dedupeKey);

    const promise = (async () => {
        const raw = await callCrixenGenerate({ token, payload });
        let cleaned = postProcessContent(raw, p);

        // ✅ Validate output length for action type
        if (actionType === 'thread') {
            const tweets = cleaned.split(/\n\n+/g).filter(t => t.trim().length > 0);
            console.log(`[Thread] Generated ${tweets.length} tweets`);
            if (tweets.length < 3) {
                console.warn('[Thread] Generated less than 3 tweets, output may be incomplete');
            }
        } else if (actionType === 'longform') {
            console.log(`[Longform] Generated ${cleaned.length} characters`);
            if (cleaned.length < 600) {
                console.warn('[Longform] Generated text too short (<600 chars)');
            }
        }

        cacheSet(dedupeKey, cleaned);
        return cleaned;
    })().finally(() => {
        mem.inflight.delete(dedupeKey);
    });

    mem.inflight.set(dedupeKey, promise);
    return promise;
}

// =============================================================================
// Strategies sync
// =============================================================================

async function updateStrategies(newStrategies) {
    const settings = await getSettings();
    settings.capturedStrategies = Array.isArray(newStrategies) ? newStrategies : [];
    await storageSet({ settings });

    const { crixen_auth, activeProjectId } = await storageGet(['crixen_auth', 'activeProjectId']);
    if (!crixen_auth?.token) return;

    try {
        const CRIXEN_API_URL = CONFIG.API_URL.replace('/api/v1/ai/generate', '');
        let projectId = activeProjectId;

        if (!projectId || projectId === 'default') {
            try {
                const projectRes = await fetchWithRetry(
                    `${CRIXEN_API_URL}/api/v1/projects`,
                    { headers: { Authorization: `Bearer ${crixen_auth.token}` } },
                    API_TIMEOUT,
                    (r) => [429, 500, 502, 503, 504].includes(r.status)
                );

                if (projectRes.ok) {
                    const pData = await projectRes.json();
                    if (pData?.projects?.length) {
                        projectId = pData.projects[0].id;
                        await storageSet({ activeProjectId: projectId });
                    }
                }
            } catch (e) {
                console.warn('[NOVA] Failed to fetch default project:', e?.message || e);
            }
        }

        if (!projectId || projectId === 'default') {
            console.warn('[NOVA] Aborting sync: No valid Project ID found.');
            return;
        }

        const response = await fetchWithRetry(
            `${CRIXEN_API_URL}/api/v1/nova/upload`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${crixen_auth.token}`
                },
                body: JSON.stringify({
                    projectId,
                    strategyData: settings.capturedStrategies,
                    groupId: 'crixen-strategies'
                })
            },
            API_TIMEOUT,
            (r) => [429, 500, 502, 503, 504].includes(r.status)
        );

        if (response.ok) {
            const result = await response.json();
            await storageSet({
                strategyCID: result.cid,
                strategyLastSync: Date.now()
            });
        } else {
            console.warn('[NOVA] Failed to sync strategies:', response.status);
        }
    } catch (error) {
        console.warn('[NOVA] Sync error (non-blocking):', error?.message || error);
    }
}

// =============================================================================
// NOTION tools
// =============================================================================

async function callNearAI(prompt, maxTokens = null) {
    const { token } = await storageGet('token');
    if (!token) throw new CrixenError(ERR.AUTH_REQUIRED, 'Not authenticated');

    const payload = {
        projectId: 'notion-tools',
        prompt: assertString('prompt', prompt, { min: 10, max: 50_000 }),
        context: ''
    };
    if (maxTokens) payload.maxTokens = maxTokens;

    const raw = await callCrixenGenerate({ token, payload });
    return raw.trim().replace(/^["']|["']$/g, '');
}

async function generateStrategyDoc(inputs = {}) {
    let context = '';
    if (typeof inputs === 'string') {
        context = inputs;
    } else {
        context = `
- Brand Name: ${inputs.brandName || 'Not specified'}
- Industry: ${inputs.industry || 'Not specified'}
- Target Audience: ${inputs.audience_mission || 'Not specified'}
- Brand Voice: ${inputs.brandVoice || 'Professional'}
- Unique Value: ${inputs.usp || 'Not specified'}
    `.trim();
    }

    return callNearAI(
        `You are a world-class Social Media Strategist.
Create an extremely detailed, high-end Brand Social Media Strategy document in Markdown.

USER CONTEXT:
${context}

Include:
1. Executive Summary
2. Brand Pillars (3 themes)
3. Tone of Voice
4. Target Audience Persona
5. Content Mix Table
6. Growth Tactics

Output ONLY markdown.`,
        2500
    );
}

async function generateSmartReport(stats) {
    const safeStats = stats && typeof stats === 'object' ? stats : {};
    return callNearAI(
        `You are a professional Social Media Manager.
Analyze daily metrics and provide a professional summary in Markdown.

Metrics:
- Generated: ${safeStats.generated || 0}
- Posted: ${safeStats.posted || 0}
- Styles: ${JSON.stringify(safeStats.byStyle || {})}

Output Title, Executive Summary, Metrics Table, Insights.
Output ONLY markdown.`,
        1500
    );
}

async function generateToolkitDoc(type, inputs = {}) {
    let context = '';

    if (typeof inputs === 'string') {
        context = inputs;
    } else if (type === 'calendar') {
        context = `
- Brand: ${inputs.brandName}
- Description: ${inputs.description}
- Industry: ${inputs.industry}
- Posting Frequency: ${inputs.frequency} per week
    `.trim();
    } else if (type === 'audit') {
        context = `
- Brand: ${inputs.brandName}
- Industry: ${inputs.industry}
- Description: ${inputs.description}
- Analyze: ${inputs.analyze_what}
- Current Strength: ${inputs.strength || 'Unknown'}
    `.trim();
    } else if (type === 'influencer') {
        context = `
- Campaign Goal: ${inputs.goal}
- Industry: ${inputs.industry}
- Budget: ${inputs.budget}
- Platforms: ${inputs.platforms}
- Deliverables: ${inputs.deliverables || 'Standard'}
- Timeline: ${inputs.timeline || 'ASAP'}
    `.trim();
    }

    const prompts = {
        calendar: `You are an expert Social Media Manager.
Create a 4-Week Social Media Content Calendar Template in Markdown.

USER CONTEXT:
${context}

Table columns: [Week], [Theme], [Post Type], [Caption Idea], [Status].
Output ONLY markdown.`,

        audit: `You are an expert Social Media Manager.
Create a Competitor Audit Report in Markdown.

USER CONTEXT:
${context}

Sections:
1. Competitor Analysis
2. SWOT Analysis
3. Content Gap Analysis
4. Action Plan

Output ONLY markdown.`,

        influencer: `You are an expert Social Media Manager.
Create an Influencer Outreach Tracker & Plan in Markdown.

USER CONTEXT:
${context}

Table columns: [Name], [Niche], [Platform], [Follower Count], [Status], [Notes].
Include 3 tailored Outreach Email Templates.
Output ONLY markdown.`
    };

    if (!prompts[type]) throw new CrixenError(ERR.BAD_INPUT, 'Invalid Tool');
    return callNearAI(prompts[type], 2500);
}

async function testApiConnection(apiKey) {
    const cleanedKey = apiKey ? apiKey.replace(/[<>\s]/g, '') : '';
    if (!cleanedKey) return { success: false, error: 'No API key provided' };

    try {
        const response = await fetchWithTimeout(NEAR_AI_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cleanedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-V3.1',
                messages: [{ role: 'user', content: 'Say OK' }],
                max_tokens: 5
            })
        });

        if (response.ok) return { success: true, message: 'API connection successful!' };

        const text = await response.text();
        return { success: false, error: `API Error: ${response.status} - ${text}` };
    } catch (error) {
        const e = normalizeError(error);
        return { success: false, error: e.message };
    }
}