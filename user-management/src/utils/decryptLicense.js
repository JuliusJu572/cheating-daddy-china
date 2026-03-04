const crypto = require('node:crypto');

/**
 * 解密 License Key (CD-xxxxx) 得到明文 API Key
 * 与主应用 src/index.js 的 decrypt-license-key 逻辑一致
 */
function decryptLicenseKey(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string') {
        return { success: false, error: 'Invalid license' };
    }
    try {
        const cleanedKey = licenseKey.trim().replace(/^CD-/, '').replace(/-/g, '');
        const cipherBuf = Buffer.from(cleanedKey, 'base64');

        const key = crypto.scryptSync('CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572', 'salt', 32);
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        decipher.setAutoPadding(false);

        const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
        const lastByte = decrypted[decrypted.length - 1];

        if (lastByte < 1 || lastByte > 16) {
            return { success: false, error: 'Invalid padding' };
        }

        for (let i = 0; i < lastByte; i++) {
            if (decrypted[decrypted.length - 1 - i] !== lastByte) {
                return { success: false, error: 'Invalid padding bytes' };
            }
        }

        const plain = decrypted.slice(0, decrypted.length - lastByte).toString('utf8');

        if (plain.length < 10) {
            return { success: false, error: 'Decrypted text too short' };
        }

        return { success: true, apiKey: plain };
    } catch (error) {
        return { success: false, error: 'Decrypt failed' };
    }
}

module.exports = { decryptLicenseKey };
