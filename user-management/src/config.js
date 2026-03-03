const path = require('node:path');
require('dotenv').config();

function toInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const uploadDir = process.env.UPLOAD_DIR || 'uploads';

module.exports = {
    port: toInt(process.env.PORT, 8787),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || '',
    modelApiBase: process.env.MODEL_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelApiKey: process.env.MODEL_API_KEY || '',
    uploadDirAbs: path.resolve(process.cwd(), uploadDir),
    maxUploadBytes: toInt(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
};
