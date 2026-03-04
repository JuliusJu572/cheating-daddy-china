const express = require('express');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');

const router = express.Router();

function fail(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

function sanitizeBase(base, fallback) {
    const v = String(base || '').trim();
    return (v || fallback || '').replace(/\/$/, '');
}

function parseUsage(rawUsage = {}) {
    const promptTokens = Number(
        rawUsage.prompt_tokens ??
        rawUsage.input_tokens ??
        0
    ) || 0;
    const completionTokens = Number(
        rawUsage.completion_tokens ??
        rawUsage.output_tokens ??
        0
    ) || 0;
    const totalTokens = Number(
        rawUsage.total_tokens ??
        (promptTokens + completionTokens)
    ) || 0;

    return {
        promptTokens: Math.max(0, Math.floor(promptTokens)),
        completionTokens: Math.max(0, Math.floor(completionTokens)),
        totalTokens: Math.max(0, Math.floor(totalTokens)),
    };
}

function decryptLicenseKeyToApiKey(licenseKey) {
    const cleanedKey = String(licenseKey || '').trim().replace(/^CD-/i, '').replace(/-/g, '');
    if (!cleanedKey) {
        throw new Error('license key is empty');
    }
    const cipherBuf = Buffer.from(cleanedKey, 'base64');
    const key = crypto.scryptSync('CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572', 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    const pad = decrypted[decrypted.length - 1];
    if (pad < 1 || pad > 16) {
        throw new Error('invalid license padding');
    }
    for (let i = 0; i < pad; i++) {
        if (decrypted[decrypted.length - 1 - i] !== pad) {
            throw new Error('invalid license padding bytes');
        }
    }
    const plain = decrypted.slice(0, decrypted.length - pad).toString('utf8').trim();
    if (plain.length < 10) {
        throw new Error('decrypted api key too short');
    }
    return plain;
}

async function authJwtAndLicense(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : '';
    if (!bearer) {
        return fail(res, 401, 'Missing bearer token', 'AUTH_MISSING');
    }
    let payload = null;
    try {
        payload = jwt.verify(bearer, config.jwtSecret);
    } catch (_) {
        return fail(res, 401, 'Invalid token', 'TOKEN_INVALID');
    }

    const licenseKey = String(req.headers['x-license-key'] || '').trim();
    if (!licenseKey) {
        return fail(res, 401, 'Missing license key', 'LICENSE_MISSING');
    }

    let upstreamApiKey = '';
    try {
        upstreamApiKey = decryptLicenseKeyToApiKey(licenseKey);
    } catch (_) {
        return fail(res, 401, 'Invalid license key', 'LICENSE_INVALID');
    }

    req.user = { id: payload.uid };
    req.upstreamApiKey = upstreamApiKey;
    return next();
}


async function getUserQuotaState(userId) {
    const result = await pool.query(
        `
        SELECT
            u.id,
            COALESCE(u.frozen, FALSE) AS frozen,
            COALESCE(u.quota_tokens, 1000000) AS quota_tokens,
            COALESCE(SUM(tu.total_tokens), 0)::bigint AS used_tokens
        FROM users u
        LEFT JOIN token_usage tu ON tu.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id, u.frozen, u.quota_tokens
        LIMIT 1
        `,
        [userId]
    );
    return result.rows[0] || null;
}

async function assertAccountAvailable(userId) {
    const row = await getUserQuotaState(userId);
    if (!row) {
        return { ok: false, status: 404, error: 'user not found', code: 'USER_NOT_FOUND' };
    }
    if (row.frozen) {
        return { ok: false, status: 403, error: '账号已冻结，请联系管理员', code: 'account_frozen' };
    }
    if (Number(row.used_tokens) >= Number(row.quota_tokens)) {
        await pool.query(`UPDATE users SET frozen = TRUE WHERE id = $1`, [userId]);
        return { ok: false, status: 403, error: '已超出 token 配额，账号已暂时冻结', code: 'quota_exceeded' };
    }
    return { ok: true, state: row };
}

async function recordUsage({ userId, callType, model, usage }) {
    const { promptTokens, completionTokens, totalTokens } = parseUsage(usage);
    await pool.query(
        `
        INSERT INTO token_usage(user_id, call_type, model, prompt_tokens, completion_tokens, total_tokens)
        VALUES($1, $2, $3, $4, $5, $6)
        `,
        [userId, callType, String(model || 'unknown'), promptTokens, completionTokens, totalTokens]
    );

    const row = await getUserQuotaState(userId);
    if (row && Number(row.used_tokens) >= Number(row.quota_tokens)) {
        await pool.query(`UPDATE users SET frozen = TRUE WHERE id = $1`, [userId]);
    }
}

function buildCommonHeaders(apiKey) {
    const key = String(apiKey || '').trim();
    if (!key) {
        throw new Error('Upstream API key is required');
    }
    return {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${key}`,
    };
}

async function proxyJson({ req, res, callType, endpoint, buildPayload }) {
    const gate = await assertAccountAvailable(req.user.id);
    if (!gate.ok) return fail(res, gate.status, gate.error, gate.code);

    const payload = buildPayload(req.body || {});
    let upstreamRes;
    try {
        upstreamRes = await fetch(endpoint, {
            method: 'POST',
            headers: buildCommonHeaders(req.upstreamApiKey),
            body: JSON.stringify(payload),
        });
    } catch (error) {
        return fail(res, 502, error.message || 'upstream request failed', 'UPSTREAM_REQUEST_FAILED');
    }

    const text = await upstreamRes.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch (_) {}

    if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({
            success: false,
            error: data?.error?.message || data?.error || text || `upstream ${upstreamRes.status}`,
            code: 'UPSTREAM_API_ERROR',
        });
    }

    try {
        await recordUsage({
            userId: req.user.id,
            callType,
            model: payload.model,
            usage: data?.usage || {},
        });
    } catch (error) {
        console.error('[ai-proxy] failed to record usage:', error);
    }

    return res.json(data);
}

async function proxySse({ req, res, callType, endpoint, buildPayload }) {
    const gate = await assertAccountAvailable(req.user.id);
    if (!gate.ok) return fail(res, gate.status, gate.error, gate.code);

    const payload = buildPayload(req.body || {});
    payload.stream = true;
    payload.stream_options = { include_usage: true };

    let upstreamRes;
    try {
        upstreamRes = await fetch(endpoint, {
            method: 'POST',
            headers: buildCommonHeaders(req.upstreamApiKey),
            body: JSON.stringify(payload),
        });
    } catch (error) {
        return fail(res, 502, error.message || 'upstream request failed', 'UPSTREAM_REQUEST_FAILED');
    }

    if (!upstreamRes.ok) {
        const text = await upstreamRes.text();
        return res.status(upstreamRes.status).json({
            success: false,
            error: text || `upstream ${upstreamRes.status}`,
            code: 'UPSTREAM_API_ERROR',
        });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let usageForRecord = {};
    const decoder = new TextDecoder('utf-8');
    let lineBuffer = '';

    const body = upstreamRes.body;
    if (!body) {
        res.end();
        return;
    }

    function handleSseLines(chunkText) {
        lineBuffer += chunkText;
        let idx = -1;
        while ((idx = lineBuffer.indexOf('\n')) >= 0) {
            const line = lineBuffer.slice(0, idx).trimEnd();
            lineBuffer = lineBuffer.slice(idx + 1);
            if (!line || !line.startsWith('data:')) continue;
            const dataStr = line.slice('data:'.length).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
                const evt = JSON.parse(dataStr);
                if (evt?.usage) usageForRecord = evt.usage;
            } catch (_) {}
        }
    }

    try {
        if (typeof body.getReader === 'function') {
            const reader = body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkText = decoder.decode(value, { stream: true });
                handleSseLines(chunkText);
                res.write(value);
            }
        } else {
            for await (const chunk of body) {
                const chunkText = decoder.decode(chunk, { stream: true });
                handleSseLines(chunkText);
                res.write(chunk);
            }
        }
    } finally {
        res.end();
    }

    try {
        await recordUsage({
            userId: req.user.id,
            callType,
            model: payload.model,
            usage: usageForRecord || {},
        });
    } catch (error) {
        console.error('[ai-proxy] failed to record stream usage:', error);
    }
}

router.post('/chat', authJwtAndLicense, async (req, res) => {
    const base = sanitizeBase(config.aiApiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const endpoint = `${base}/chat/completions`;
    return proxySse({
        req,
        res,
        callType: 'chat',
        endpoint,
        buildPayload: (body) => ({
            model: String(body.model || '').trim(),
            messages: Array.isArray(body.messages) ? body.messages : [],
            max_tokens: Number(body.max_tokens || 2048),
            extra_body: body.extra_body && typeof body.extra_body === 'object' ? body.extra_body : { enable_thinking: false },
        }),
    });
});

router.post('/enrich', authJwtAndLicense, async (req, res) => {
    const base = sanitizeBase(config.aiApiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const endpoint = `${base}/chat/completions`;
    return proxySse({
        req,
        res,
        callType: 'enrich',
        endpoint,
        buildPayload: (body) => ({
            model: String(body.model || '').trim(),
            messages: Array.isArray(body.messages) ? body.messages : [],
            max_tokens: Number(body.max_tokens || 1024),
            extra_body: body.extra_body && typeof body.extra_body === 'object' ? body.extra_body : { enable_thinking: false },
        }),
    });
});

router.post('/resume', authJwtAndLicense, async (req, res) => {
    const base = sanitizeBase(config.aiApiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const endpoint = `${base}/chat/completions`;
    return proxyJson({
        req,
        res,
        callType: 'resume',
        endpoint,
        buildPayload: body => ({
            model: String(body.model || 'qwen-plus'),
            messages: Array.isArray(body.messages) ? body.messages : [],
            temperature: Number(body.temperature ?? 0.2),
            stream: false,
        }),
    });
});

router.post('/jd', authJwtAndLicense, async (req, res) => {
    const base = sanitizeBase(config.aiApiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const endpoint = `${base}/chat/completions`;
    return proxyJson({
        req,
        res,
        callType: 'jd',
        endpoint,
        buildPayload: body => ({
            model: String(body.model || 'qwen-plus'),
            messages: Array.isArray(body.messages) ? body.messages : [],
            temperature: Number(body.temperature ?? 0.2),
            stream: false,
        }),
    });
});

router.post('/clean', authJwtAndLicense, async (req, res) => {
    const base = sanitizeBase(config.aiApiBase, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const endpoint = `${base}/chat/completions`;
    return proxyJson({
        req,
        res,
        callType: 'clean',
        endpoint,
        buildPayload: body => ({
            model: String(body.model || 'qwen3.5-flash'),
            messages: Array.isArray(body.messages) ? body.messages : [],
            stream: false,
            max_tokens: Number(body.max_tokens || 512),
            extra_body: body.extra_body && typeof body.extra_body === 'object' ? body.extra_body : { enable_thinking: false },
        }),
    });
});

router.post('/asr', authJwtAndLicense, async (req, res) => {
    const asrBase = sanitizeBase(config.aiAsrApiBase, 'https://dashscope.aliyuncs.com/api/v1');
    const endpoint = `${asrBase}/services/aigc/multimodal-generation/generation`;
    return proxyJson({
        req,
        res,
        callType: 'asr',
        endpoint,
        buildPayload: body => ({
            model: String(body.model || 'qwen3-asr-flash'),
            input: body.input && typeof body.input === 'object' ? body.input : {},
            parameters: body.parameters && typeof body.parameters === 'object' ? body.parameters : {},
        }),
    });
});

module.exports = router;
