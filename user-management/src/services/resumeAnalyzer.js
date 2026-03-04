const config = require('../config');

function buildAnalysisPrompt(rawText) {
    return [
        '你是面试答题辅助型的简历结构化分析助手。',
        '目标是让 AI 更了解被试，能给出更贴合简历和岗位的回答。',
        '',
        '输出要求：',
        '1) 使用以下固定小节标题，每节单独成段：',
        '【候选人定位】',
        '【核心技术栈】',
        '【工作经历与量化成就】',
        '【代表项目与技术价值】',
        '【教育与证书】',
        '【个人核心卖点】',
        '2) 每节标题后换行，再写该节内容。',
        '3) 只输出纯文本，不要 Markdown 或代码块。总长度控制在 700 字以内。',
        '',
        '以下是简历原文：',
        rawText || '',
    ].join('\n');
}

async function analyzeResume(rawText, apiKey) {
    const key = (apiKey || config.modelApiKey || '').trim();
    if (!key) {
        throw new Error('请使用 License Key 登录，或配置 MODEL_API_KEY 以使用简历解析');
    }

    const endpoint = `${String(config.modelApiBase).replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: 'qwen-plus',
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
