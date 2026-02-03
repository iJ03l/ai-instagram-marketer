// Instagram AI Comment Assistant - Background Service Worker
// All models powered by NEAR AI Cloud (cloud.near.ai)

const NEAR_AI_ENDPOINT = 'https://cloud-api.near.ai/v1/chat/completions';
const API_TIMEOUT = 60000;

const AI_MODELS = {
    'deepseek': {
        name: 'DeepSeek V3.1',
        model: 'deepseek-ai/DeepSeek-V3.1',
        description: '128K context • $1.05/M input • Cheapest',
        vision: false
    },
    'openai': {
        name: 'OpenAI GPT-5.2',
        model: 'openai/gpt-5.2',
        description: '400K context • $1.8/M input • Vision enabled',
        vision: true
    },
    'claude': {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4-5',
        description: '200K context • $3/M input • Best vision',
        vision: true
    }
};

const COMMENT_STYLES = {
    friendly: {
        name: 'Friendly',
        prompt: 'Generate a warm, supportive, friendly comment. Include 1-2 relevant emojis. Keep it genuine.'
    },
    professional: {
        name: 'Professional',
        prompt: 'Generate a polished, business-appropriate comment. Be thoughtful. Minimal emojis.'
    },
    casual: {
        name: 'Casual',
        prompt: 'Generate a relaxed, conversational comment like talking to a friend.'
    },
    enthusiastic: {
        name: 'Enthusiastic',
        prompt: 'Generate an energetic, excited comment! Show enthusiasm. Use emojis!'
    },
    witty: {
        name: 'Witty',
        prompt: 'Generate a clever, witty comment with subtle humor. Be smart but not mean.'
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
                case 'generateComment':
                    const comment = await generateComment(
                        request.postContent,
                        request.style,
                        request.customPrompt,
                        request.imageUrls
                    );
                    sendResponse({ success: true, comment });
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

async function generateComment(postContent, style, customPrompt = '', imageUrls = []) {
    const settings = await getSettings();
    let modelKey = settings.selectedModel || 'deepseek';
    if (!AI_MODELS[modelKey]) {
        console.warn(`[generateComment] Invalid model '${modelKey}' selected. Falling back to 'deepseek'.`);
        modelKey = 'deepseek';
    }

    const modelConfig = AI_MODELS[modelKey];
    const apiKey = settings.apiKey ? settings.apiKey.replace(/[<>\s]/g, '') : '';

    if (!apiKey) throw new Error('No API key');

    const stylePrompt = style === 'custom' && customPrompt
        ? customPrompt
        : (style.startsWith('custom:')
            ? ((settings.capturedStrategies || []).find(s => s.name === style.split(':')[1])?.prompt || COMMENT_STYLES.friendly.prompt)
            : COMMENT_STYLES[style]?.prompt || COMMENT_STYLES.friendly.prompt);

    const globalInstructions = settings.instructions ? `\nInstructions: ${settings.instructions}` : '';

    const systemPrompt = `You are an Instagram comment assistant.
Rules:
- Simple, relevant, human.
- Max 3 emojis.
- Style: ${stylePrompt}${globalInstructions}`;

    let userMessageContent;
    if (modelConfig.vision && imageUrls && imageUrls.length > 0) {
        userMessageContent = [
            { type: 'text', text: `Context:\n${postContent}` },
            ...imageUrls.map(url => ({ type: 'image_url', image_url: { url, detail: 'auto' } }))
        ];
    } else {
        userMessageContent = `Context:\n${postContent}`;
    }

    const payload = {
        model: modelConfig.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent }
        ],
        max_tokens: 200,
        temperature: 0.8
    };

    console.log('[generateComment] Payload:', JSON.stringify(payload));

    const response = await fetchWithTimeout(NEAR_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response';
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