import { CONFIG } from '../config.js';

// ============================================================================
// CRIXEN - Industry Standard Social Media AI Agent
// Background Service Worker
// ============================================================================
// All models powered by NEAR AI Cloud (cloud.near.ai)
// 
// Key Principles:
// 1. Platform-Aware: Twitter ≠ Instagram ≠ Notion
// 2. Brand-First: AI speaks AS the user/brand, not for them
// 3. Strategy-Driven: User captured strategies take priority
// 4. Quality-Strict: No generic responses, must reference specific content
// ============================================================================

const NEAR_AI_ENDPOINT = CONFIG.NEAR_AI_ENDPOINT;
const API_TIMEOUT = 60000;

// =============================================================================
// PLATFORM CONTEXT SYSTEM
// Each platform has unique culture, norms, and best practices
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
                    'First line is everything - make them stop scrolling',
                    'One big idea per post',
                    'End with a hook, question, or call to engage',
                    'Be opinionated, not neutral'
                ]
            }
        }
    },
    instagram: {
        name: 'Instagram',
        culture: 'Visual-first, aspirational, community-driven. Comments build real relationships. Authenticity wins.',
        actionTypes: {
            comment: {
                goal: 'Build genuine connection. Comments here matter for relationships.',
                rules: [
                    'Reference the VISUAL content specifically (colors, composition, vibe)',
                    'Be conversational and warm - this is a community',
                    'Emojis are expected and add personality',
                    'Ask questions to spark conversation',
                    'Personal connection >>> generic praise'
                ]
            }
        }
    }
};

// =============================================================================
// AI MODELS
// =============================================================================

const AI_MODELS = {
    'deepseek': {
        name: 'DeepSeek V3.1',
        model: 'deepseek-ai/DeepSeek-V3.1',
        description: 'Fast and efficient',
        vision: false
    },
    'openai': {
        name: 'OpenAI GPT-5.2',
        model: 'openai/gpt-5.2',
        description: 'Premium quality',
        vision: true
    },
    'claude': {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4-5',
        description: 'Nuanced and thoughtful',
        vision: true
    }
};

// =============================================================================
// COMMENT/CONTENT STYLES
// These define the persona/tone for generation
// =============================================================================

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

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings', 'stats'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    selectedModel: 'deepseek',
                    apiKey: '',
                    defaultStyle: 'friendly',
                    customPrompt: ''
                }
            });
        }
        if (!result.stats) {
            chrome.storage.local.set({
                stats: {
                    generated: 0,
                    posted: 0,
                    byStyle: {}
                }
            });
        }
    });
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
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
                    const status = await getAuthStatus();
                    sendResponse(status);
                    break;

                case 'generateComment':
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

                case 'generatePost':
                    const postContent = await generatePost(
                        request.topic,
                        request.platform || 'twitter'
                    );
                    sendResponse({ success: true, comment: postContent });
                    break;

                case 'getSettings':
                    const settings = await getSettings();
                    sendResponse({ settings, models: AI_MODELS, styles: COMMENT_STYLES });
                    break;

                case 'saveSettings':
                    await chrome.storage.local.set({ settings: request.settings });
                    sendResponse({ success: true });
                    break;

                case 'getStats':
                    const stats = await getStats();
                    sendResponse({ stats });
                    break;

                case 'updateStats':
                    await updateStats(request.statType, request.style);
                    sendResponse({ success: true });
                    break;

                case 'testConnection':
                    const testResult = await testApiConnection(request.apiKey);
                    sendResponse(testResult);
                    break;

                case 'saveStrategies':
                    await updateStrategies(request.strategies);
                    sendResponse({ success: true });
                    break;

                // --- NOTION GENERATORS ---

                case 'generateStrategyDoc':
                    const strategyDoc = await generateStrategyDoc(request.additionalContext);
                    sendResponse({ success: true, doc: strategyDoc });
                    break;

                case 'generateSmartReport':
                    const reportDoc = await generateSmartReport(request.stats);
                    sendResponse({ success: true, doc: reportDoc });
                    break;

                case 'generateToolkit':
                    const toolkitDoc = await generateToolkitDoc(request.toolType, request.additionalContext);
                    sendResponse({ success: true, doc: toolkitDoc });
                    break;

                // Legacy sync (cleanup if needed, but keeping primarily new auth)
                case 'loginSync':
                    console.warn('[Background] Legacy loginSync called. Prefer auth:login.');
                    if (request.token) {
                        await handleLogin(request.token, request.user);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'No token' });
                    }
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background error:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
});

// ===== AUTH HANDLERS =====

async function handleLogin(token, user, expiresAt) {
    console.log('[Auth] Login received for user:', user?.email);

    await chrome.storage.local.set({
        crixen_auth: {
            token: token,
            user: user,
            expiresAt: expiresAt || Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days default
            lastSync: Date.now()
        },
        // Backwards compatibility for other parts of extension reading 'token' directly
        token: token,
        activeProjectId: 'default' // Default for now
    });

    // Update badge to show logged-in state (small green indicator)
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Green

    // Notify all tabs that auth changed
    broadcastAuthChange('login', user);

    console.log('[Auth] Login stored successfully');
}

async function handleLogout() {
    console.log('[Auth] Logout received');

    await chrome.storage.local.remove(['crixen_auth', 'token', 'activeProjectId']); // Remove legacy keys too

    // Update badge
    chrome.action.setBadgeText({ text: '' });

    // Notify all tabs
    broadcastAuthChange('logout', null);

    console.log('[Auth] Logout complete');
}

async function handleTokenRefresh(newToken, newExpiresAt) {
    console.log('[Auth] Token refresh');

    const { crixen_auth } = await chrome.storage.local.get('crixen_auth');

    if (crixen_auth) {
        crixen_auth.token = newToken;
        crixen_auth.expiresAt = newExpiresAt;
        crixen_auth.lastSync = Date.now();

        await chrome.storage.local.set({
            crixen_auth,
            token: newToken //Sync legacy key
        });
        console.log('[Auth] Token refreshed');
    }
}

async function getAuthStatus() {
    const { crixen_auth } = await chrome.storage.local.get('crixen_auth');

    if (!crixen_auth) {
        return { authenticated: false };
    }

    // Check if token expired
    const isExpired = crixen_auth.expiresAt < Date.now();

    return {
        authenticated: !isExpired,
        user: crixen_auth.user,
        expiresAt: crixen_auth.expiresAt,
        needsRefresh: (crixen_auth.expiresAt - Date.now()) < (24 * 60 * 60 * 1000) // < 24h left
    };
}

// Broadcast auth changes to all tabs
function broadcastAuthChange(type, user) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'CRIXEN_AUTH_CHANGED',
                authType: type,
                user: user
            }).catch(() => {
                // Tab might not have content script, ignore
            });
        });
    });
}

// Auto token refresh check (every 5 minutes)
chrome.alarms.create('tokenRefreshCheck', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'tokenRefreshCheck') {
        const status = await getAuthStatus();

        if (status.authenticated && status.needsRefresh) {
            console.log('[Auth] Token expiring soon, requesting refresh from dashboard');

            // Find dashboard tab and request refresh
            const tabs = await chrome.tabs.query({
                url: [
                    'https://crixen.xyz/*',
                    'https://www.crixen.xyz/*',
                    'http://localhost:5173/*',
                    'http://127.0.0.1:5173/*'
                ]
            });

            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'CRIXEN_REQUEST_TOKEN_REFRESH'
                });
            }
        }
    }
});

async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get('settings', (result) => {
            resolve(result.settings || {
                selectedModel: 'deepseek',
                apiKey: '',
                defaultStyle: 'friendly'
            });
        });
    });
}

async function getStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get('stats', (result) => {
            resolve(result.stats || { generated: 0, posted: 0, byStyle: {} });
        });
    });
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
    await chrome.storage.local.set({ stats });
}

async function updateStrategies(newStrategies) {
    const settings = await getSettings();
    settings.capturedStrategies = newStrategies;
    await chrome.storage.local.set({ settings });
}

async function testApiConnection(apiKey) {
    const cleanedKey = apiKey ? apiKey.replace(/[<>\s]/g, '') : '';
    if (!cleanedKey) return { success: false, error: 'No API key provided' };

    try {
        const response = await fetch(NEAR_AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanedKey}`,
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
        return { success: false, error: error.message };
    }
}

// --- CORE GENERATION LOGIC ---

async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// =============================================================================
// UNIFIED PROMPT BUILDER
// Industry-standard approach: layer context for maximum quality
// =============================================================================

/**
 * Banned phrases that make AI responses sound generic/bot-like
 * The AI must NEVER use these - they're instant giveaways of lazy AI
 */
const BANNED_PHRASES = [
    'Great post!',
    'Love this!',
    'This is amazing!',
    'So true!',
    'Absolutely!',
    'This resonates',
    'Well said!',
    'Couldn\'t agree more!',
    'This is fire!',
    'Facts!',
    'Appreciate you sharing',
    'Thanks for sharing',
    'Really needed to hear this',
    'This hit different',
    'As someone who',
    'I absolutely love'
];

/**
 * Builds an industry-standard system prompt with layered context
 * Order matters: Platform → Action → Brand Voice → Style → Rules
 * 
 * @param {Object} params
 * @param {string} params.platform - 'twitter' | 'instagram'
 * @param {string} params.actionType - 'reply' | 'quote' | 'post' | 'comment'
 * @param {Object} params.settings - User settings with instructions, capturedStrategies, etc.
 * @param {string} params.styleKey - The selected style key
 * @param {string} params.customPrompt - Optional custom prompt override
 * @returns {string} The complete system prompt
 */
function buildSystemPrompt({ platform, actionType, settings, styleKey, customPrompt }) {
    const platformCtx = PLATFORM_CONTEXT[platform];
    const actionCtx = platformCtx?.actionTypes?.[actionType];

    // 1. Resolve the style/persona prompt
    let stylePrompt = '';
    if (styleKey === 'custom' && customPrompt) {
        stylePrompt = customPrompt;
    } else if (styleKey?.startsWith('custom:')) {
        // User captured strategy from Notion
        const strategyName = styleKey.split(':')[1];
        const strategy = (settings.capturedStrategies || []).find(s => s.name === strategyName);
        stylePrompt = strategy?.prompt || COMMENT_STYLES.friendly.prompt;
    } else {
        stylePrompt = COMMENT_STYLES[styleKey]?.prompt || COMMENT_STYLES.friendly.prompt;
    }

    // 2. Get brand voice instructions (user's core identity)
    const brandVoice = settings.instructions || '';

    // 3. Build the prompt with clear sections
    let prompt = `# IDENTITY & ROLE

You ARE the user. You are writing content AS them, not for them.
You are their voice on ${platformCtx?.name || 'social media'}.
Never write like an assistant or helper. Never say "I'll help you" or "Here's a response."
Just BE them and write the ${actionType}.`;

    // Add brand voice if exists (this is the user's core persona)
    if (brandVoice) {
        prompt += `

## YOUR BRAND VOICE (PRIORITIZE THIS)

${brandVoice}

This is WHO you are. Every word must align with this voice.`;
    }

    // Add style layer
    prompt += `

## YOUR TONE FOR THIS ${actionType.toUpperCase()}

${stylePrompt}`;

    // Add platform context
    if (platformCtx) {
        prompt += `

## PLATFORM: ${platformCtx.name}

Cultural Context: ${platformCtx.culture}`;
    }

    // Add action-specific rules
    if (actionCtx) {
        prompt += `

## ${actionType.toUpperCase()} RULES

Goal: ${actionCtx.goal}

${actionCtx.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`;
    }

    // Add strict quality rules (non-negotiable)
    prompt += `

# STRICT QUALITY RULES (NON-NEGOTIABLE)

1. **Specific NOT Generic**: Reference SPECIFIC details from the content. Never be vague.

2. **Banned Phrases** - NEVER use these (instant red flags):
${BANNED_PHRASES.map(p => `   - "${p}"`).join('\n')}

3. **Formatting**:
   - Use DOUBLE LINE BREAKS between sentences/thoughts for visual spacing
   - NO em dashes (—), en dashes (–), or double hyphens (--)
   - Maximum 3 emojis, only if natural for your persona

4. **Authenticity**: Write like a real person with opinions, not a sycophantic bot.

5. **Value-Add**: Every ${actionType} must add value. What's YOUR take? What insight are YOU adding?`;

    return prompt;
}

/**
 * Platform-aware post-processing
 * Cleans up AI output to match platform norms
 */
function postProcessContent(content, platform) {
    if (!content) return '';

    let cleaned = content.trim()
        // Remove dashes (forbidden in style guide)
        .replace(/—/g, ' ')   // Em dash
        .replace(/–/g, ' ')   // En dash
        .replace(/--/g, ' ')  // Double hyphen
        // Clean up multiple spaces
        .replace(/  +/g, ' ');

    // Force double spacing for readability
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n+/g, '\n\n');

    // Platform-specific cleanup
    if (platform === 'twitter') {
        // Remove trailing hashtags if more than 2
        const hashtagMatches = cleaned.match(/#\w+/g) || [];
        if (hashtagMatches.length > 2) {
            // Keep first 2 hashtags, remove others
            hashtagMatches.slice(2).forEach(tag => {
                cleaned = cleaned.replace(new RegExp(`\\s*${tag}`, 'g'), '');
            });
        }
    }

    // Check for banned phrases and log warning (don't auto-fix, could break content)
    BANNED_PHRASES.forEach(phrase => {
        if (cleaned.toLowerCase().includes(phrase.toLowerCase())) {
            console.warn(`[PostProcess] Content contains banned phrase: "${phrase}"`);
        }
    });

    return cleaned;
}

/**
 * Generate a comment/reply using the unified prompt builder
 * Now accepts platform and actionType for full context awareness
 * 
 * @param {string} postContent - The content being responded to
 * @param {string} style - Style key (friendly, witty, custom:StrategyName, etc.)
 * @param {string} customPrompt - Optional custom prompt override
 * @param {string[]} imageUrls - Image URLs for vision models
 * @param {string} platform - 'twitter' | 'instagram' (default: 'instagram')
 * @param {string} actionType - 'reply' | 'quote' | 'comment' (default: based on platform)
 */
async function generateComment(postContent, style, customPrompt = '', imageUrls = [], platform = 'instagram', actionType = null) {
    const settings = await getSettings();

    // Validate model
    let modelKey = settings.selectedModel || 'deepseek';
    if (!AI_MODELS[modelKey]) {
        console.warn(`[generateComment] Invalid model '${modelKey}'. Falling back to 'deepseek'.`);
        modelKey = 'deepseek';
    }

    // Determine action type if not specified
    const resolvedActionType = actionType || (platform === 'twitter' ? 'reply' : 'comment');

    // Build the industry-standard system prompt
    const systemPrompt = buildSystemPrompt({
        platform,
        actionType: resolvedActionType,
        settings,
        styleKey: style,
        customPrompt
    });

    console.log(`[generateComment] Platform: ${platform}, Action: ${resolvedActionType}, Style: ${style}`);

    // Auth Check
    const { token, activeProjectId } = await new Promise(resolve =>
        chrome.storage.local.get(['token', 'activeProjectId'], resolve)
    );

    if (!token) {
        console.error('No auth token found. Please login.');
        return { error: 'AUTH_REQUIRED' };
    }

    const projectId = activeProjectId || 'default';

    const payload = {
        projectId,
        prompt: systemPrompt,
        context: postContent
    };

    console.log('[generateComment] Calling Crixen API with unified prompt');

    const CRIXEN_API_URL = CONFIG.API_URL;

    const response = await fetchWithTimeout(CRIXEN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 401) {
        return { error: 'AUTH_REQUIRED' };
    }

    if (!response.ok) {
        let errorMessage;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || await response.text();
        } catch (e) {
            errorMessage = await response.text();
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    let content = data.content || data.choices?.[0]?.message?.content || 'No response';

    // Apply platform-aware post-processing
    return postProcessContent(content, platform);
}

/**
 * Generate a new post using the unified prompt builder
 * Always uses Twitter/post context since this is for creating new content
 * 
 * @param {string} topic - The topic/vibe for the post
 * @param {string} platform - 'twitter' | 'instagram' (default: 'twitter')
 */
async function generatePost(topic, platform = 'twitter') {
    const settings = await getSettings();

    // Auth Check
    const { token, activeProjectId } = await new Promise(resolve =>
        chrome.storage.local.get(['token', 'activeProjectId'], resolve)
    );

    if (!token) return { error: 'AUTH_REQUIRED' };

    const projectId = activeProjectId || 'default';
    const style = settings.defaultStyle || 'professional';
    const customPrompt = settings.customPrompt || '';

    // Build the industry-standard system prompt for post creation
    const systemPrompt = buildSystemPrompt({
        platform,
        actionType: 'post',
        settings,
        styleKey: style,
        customPrompt
    });

    console.log(`[generatePost] Platform: ${platform}, Style: ${style}, Topic: ${topic.substring(0, 50)}...`);

    const payload = {
        projectId,
        prompt: systemPrompt,
        context: topic
    };

    const CRIXEN_API_URL = CONFIG.API_URL;

    const response = await fetchWithTimeout(CRIXEN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 401) {
        return { error: 'AUTH_REQUIRED' };
    }

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Error ${response.status}: ${err}`);
    }

    const data = await response.json();
    let content = data.content || data.choices?.[0]?.message?.content || 'No response';

    // Apply platform-aware post-processing
    return postProcessContent(content, platform);
}

// --- GENERIC CALLER FOR NOTION TOOLS ---

async function callNearAI(prompt, maxTokens = null) {
    const settings = await getSettings();
    // Map simple key to full model ID
    const modelKey = settings.selectedModel || 'deepseek';
    const modelID = AI_MODELS[modelKey]?.model || 'deepseek-ai/DeepSeek-V3.1';

    // Fallback cleanup if user data has old V3 string
    // This is less likely with new keys, but safe to keep logic simple

    const apiKey = settings.apiKey ? settings.apiKey.replace(/[<>\s]/g, '') : '';
    if (!apiKey) throw new Error('No API key');

    // STRICT MINIMAL PAYLOAD for Strategy/Report
    const payload = {
        model: modelID,
        messages: [{ role: 'user', content: prompt }]
    };

    if (maxTokens) payload.max_tokens = maxTokens;

    console.log('[callNearAI] Request:', JSON.stringify(payload));

    const response = await fetchWithTimeout(NEAR_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty AI response');
    return content.replace(/^["']|["']$/g, '').trim(); // Clean quotes
}

// --- NOTION GENERATORS ---

async function generateStrategyDoc(inputs = {}) {
    // Robustly handle string or object input for backward compatibility
    let context = '';
    if (typeof inputs === 'string') {
        context = inputs;
    } else {
        context = `
    - Brand Name: ${inputs.brandName || 'Not specified'}
    - Industry: ${inputs.industry || 'Not specified'}
    - Target Audience: ${inputs.targetAudience || 'Not specified'}
    - Main Goals: ${inputs.goals || 'Not specified'}
    - Platforms: ${inputs.platforms || 'Not specified'}
    - Brand Voice: ${inputs.brandVoice || 'Professional'}
    - Unique Value: ${inputs.uniqueValue || 'Not specified'}
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
        2500 // Max tokens
    );
}

async function generateSmartReport(stats) {
    return callNearAI(
        `You are a professional Social Media Manager.
Analyze daily metrics and provide a professional summary in Markdown.
Metrics:
- Generated: ${stats.generated || 0}
- Posted: ${stats.posted || 0}
- Styles: ${JSON.stringify(stats.byStyle || {})}
Output Title, Executive Summary, Metrics Table, Insights.
Output ONLY markdown.`,
        1500
    );
}

async function generateToolkitDoc(type, inputs = {}) {
    // Handle Context from inputs object
    let context = '';
    let emailGoal = 'General Outreach';

    if (typeof inputs === 'string') {
        context = inputs;
    } else if (type === 'calendar') {
        context = `
    - Brand: ${inputs.brandName}
    - Industry: ${inputs.industry}
    - Content Themes: ${inputs.themes}
    - Posting Frequency: ${inputs.frequency}
    - Content Types: ${inputs.contentTypes}
    - Current Campaign: ${inputs.campaign || 'General'}
        `.trim();
    } else if (type === 'audit') {
        context = `
    - Brand: ${inputs.brandName}
    - Industry: ${inputs.industry}
    - Competitors: ${inputs.competitors}
    - Platforms to Analyze: ${inputs.platforms}
    - Focus Metrics: ${inputs.metrics}
    - Current Strength: ${inputs.strength || 'Unknown'}
        `.trim();
    } else if (type === 'influencer') {
        context = `
    - Industry: ${inputs.industry}
    - Campaign Goal: ${inputs.goal}
    - Budget: ${inputs.budget}
    - Influencer Tier: ${inputs.tier}
    - Platforms: ${inputs.platforms}
    - Deliverables: ${inputs.deliverables || 'Standard'}
    - Timeline: ${inputs.timeline || 'ASAP'}
        `.trim();
        emailGoal = inputs.goal;
    }

    const prompts = {
        calendar: `You are an expert Social Media Manager.
Create a 4-Week Social Media Content Calendar Template in Markdown based on the user's specific needs.

USER CONTEXT:
${context}

Table columns: [Week], [Theme], [Post Type], [Caption Idea], [Status].
Ensure the content matches their industry (${inputs.industry || 'General'}) and frequency (${inputs.frequency || 'Daily'}).
Output ONLY markdown.`,

        audit: `You are an expert Social Media Manager.
Create a Competitor Audit Report in Markdown.

USER CONTEXT:
${context}

Sections: 
1. Audit of the specific competitors mentioned.
2. SWOT Analysis for ${inputs.brandName || 'the brand'}.
3. Content Gap Analysis vs competitors.
4. Action Plan to beat the metric: ${inputs.metrics || 'Engagement'}.
Output ONLY markdown.`,

        influencer: `You are an expert Social Media Manager.
Create an Influencer Outreach Tracker & Plan in Markdown.

USER CONTEXT:
${context}

Table columns: [Name], [Niche], [Platform], [Follower Count], [Status], [Notes].
Include 3 tailored Outreach Email Templates based on their campaign goal: ${emailGoal}.
Output ONLY markdown.`
    };

    if (!prompts[type]) throw new Error('Invalid Tool');
    return callNearAI(prompts[type], 2500);
}