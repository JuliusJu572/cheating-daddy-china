const path = require('node:path');
require('dotenv').config();

function toInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const uploadDir = process.env.UPLOAD_DIR || 'uploads';

function parseAdminEmails() {
    const raw = String(process.env.ADMIN_EMAILS || '').trim();
    if (!raw) return [];
    return raw.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

module.exports = {
    port: toInt(process.env.PORT, 8787),
    adminEmails: parseAdminEmails(),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || '',

    // 简历解析大模型：优先使用用户 License Key 解密后的 API Key，此处仅作备用（如管理员邮箱注册无 license_key 时）
    modelApiBase: process.env.MODEL_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelApiKey: process.env.MODEL_API_KEY || '',
    aiApiBase: process.env.AI_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    aiApiKey: process.env.AI_API_KEY || '',
    aiAsrApiBase: process.env.AI_ASR_API_BASE || 'https://dashscope.aliyuncs.com/api/v1',

    uploadDirAbs: path.resolve(process.cwd(), uploadDir),
    maxUploadBytes: toInt(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
};
