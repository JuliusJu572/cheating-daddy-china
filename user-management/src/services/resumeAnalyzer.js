const config = require('../config');

function buildAnalysisPrompt(rawText) {
    return [
        '你是简历结构化分析助手。请将用户简历提炼成可直接注入面试 AI 的上下文。',
        '输出要求：',
        '1) 只输出中文纯文本，不要 Markdown 标题和代码块。',
        '2) 包含：候选人定位、核心技能、工作经历亮点、项目亮点、教育背景、可展开提问点。',
        '3) 总长度控制在 1200 字以内。',
        '',
        '以下是简历原文：',
        rawText || '',
    ].join('\n');
}

async function analyzeResume(rawText) {
    if (!config.modelApiKey) {
        throw new Error('MODEL_API_KEY is required for AI resume analysis');
    }

    const endpoint = `${String(config.modelApiBase).replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${config.modelApiKey}`,
        },
        body: JSON.stringify({
            model: 'qwen3.5-plus',
            messages: [
                { role: 'system', content: '你是资深技术招聘顾问。' },
                { role: 'user', content: buildAnalysisPrompt(rawText) },
            ],
            temperature: 0.2,
            stream: false,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resume analyze failed: HTTP ${res.status} ${text}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        const textPart = content.find(x => typeof x?.text === 'string');
        return String(textPart?.text || '').trim();
    }
    return '';
}

module.exports = { analyzeResume };
