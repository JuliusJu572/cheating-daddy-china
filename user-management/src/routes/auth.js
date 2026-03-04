const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const config = require('../config');

const router = express.Router();

function fail(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

function issueToken(userId) {
    return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 普通用户：邮箱注册 */
router.post('/register', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email 和 password 必填', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, '邮箱格式无效', 'AUTH_INVALID_EMAIL');
        }
        if (password.length < 8) {
            return fail(res, 400, '密码至少 8 位', 'AUTH_WEAK_PASSWORD');
        }

        const hash = await bcrypt.hash(password, 10);
        const inserted = await pool.query(
            `INSERT INTO users(email, password_hash, role) VALUES($1, $2, 'user')
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, license_key, created_at, COALESCE(role, 'user') AS role`,
            [email, hash]
        );

        if (inserted.rowCount === 0) {
            return fail(res, 409, '该邮箱已注册，请直接登录', 'AUTH_EMAIL_EXISTS');
        }

        const user = inserted.rows[0];
        const token = issueToken(user.id);
        return res.json({ success: true, token, user });
    } catch (err) {
        return fail(res, 500, err.message, 'AUTH_REGISTER_FAILED');
    }
});

/** 普通用户：邮箱登录 */
router.post('/login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email 和 password 必填', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, '邮箱格式无效', 'AUTH_INVALID_EMAIL');
        }

        const result = await pool.query(
            `SELECT id, email, password_hash, license_key, created_at, COALESCE(role, 'user') AS role
             FROM users
             WHERE LOWER(TRIM(email)) = $1
             LIMIT 1`,
            [email]
        );
        const user = result.rows[0];
        if (!user || !user.password_hash) {
            return fail(res, 401, '邮箱或密码错误', 'AUTH_INVALID_CREDENTIALS');
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return fail(res, 401, '邮箱或密码错误', 'AUTH_INVALID_CREDENTIALS');
        }

        const token = issueToken(user.id);
        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email || '',
                license_key: user.license_key || '',
                created_at: user.created_at,
                role: user.role || 'user',
            },
        });
    } catch (err) {
        return fail(res, 500, err.message, 'AUTH_LOGIN_FAILED');
    }
});

router.post('/license', async (req, res) => {
    try {
        const licenseKey = String(req.body?.licenseKey || '').trim();
        if (!licenseKey) {
            return fail(res, 400, 'licenseKey required', 'AUTH_MISSING_LICENSE');
        }

        let user = (
            await pool.query(
                `SELECT id, email, license_key, created_at FROM users WHERE license_key = $1 LIMIT 1`,
                [licenseKey]
            )
        ).rows[0];

        if (!user) {
            user = (
                await pool.query(
                    `
                    INSERT INTO users(license_key)
                    VALUES($1)
                    RETURNING id, email, license_key, created_at
                    `,
                    [licenseKey]
                )
            ).rows[0];
        }

        const token = issueToken(user.id);
        return res.json({ success: true, token, user });
    } catch (err) {
        return fail(res, 500, err.message, 'AUTH_LICENSE_FAILED');
    }
});

/** Web 管理后台：管理员注册（仅 ADMIN_EMAILS 中的邮箱可注册为管理员） */
router.post('/admin-register', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email 和 password 必填', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, '邮箱格式无效', 'AUTH_INVALID_EMAIL');
        }
        if (password.length < 8) {
            return fail(res, 400, '密码至少 8 位', 'AUTH_WEAK_PASSWORD');
        }

        const adminEmails = config.adminEmails || [];
        if (adminEmails.length === 0) {
            return fail(res, 503, '管理员未配置，请联系部署者设置 ADMIN_EMAILS', 'AUTH_ADMIN_NOT_CONFIGURED');
        }
        if (!adminEmails.includes(email)) {
            return fail(res, 403, '仅配置的管理员邮箱可注册', 'AUTH_ADMIN_REQUIRED');
        }

        const hash = await bcrypt.hash(password, 10);
        const inserted = await pool.query(
            `INSERT INTO users(email, password_hash, role) VALUES($1, $2, 'admin')
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, created_at`,
            [email, hash]
        );
        if (inserted.rowCount === 0) {
            return fail(res, 409, '该邮箱已注册，请直接登录', 'AUTH_EMAIL_EXISTS');
        }
        const user = inserted.rows[0];
        const token = issueToken(user.id);
        return res.json({ success: true, token, user });
    } catch (err) {
        return fail(res, 500, err.message, 'AUTH_ADMIN_REGISTER_FAILED');
    }
});

/** Web 管理后台：管理员登录（邮箱 + 密码，仅 role=admin 可登录） */
router.post('/admin-login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email 和 password 必填', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, '邮箱格式无效', 'AUTH_INVALID_EMAIL');
        }

        const result = await pool.query(
            `SELECT id, email, password_hash, COALESCE(role, 'user') AS role FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
            [email]
        );
        const user = result.rows[0];
        if (!user || !user.password_hash) {
            return fail(res, 401, '邮箱或密码错误', 'AUTH_INVALID_CREDENTIALS');
        }
        if (user.role !== 'admin') {
            return fail(res, 403, '仅管理员可登录管理后台', 'AUTH_ADMIN_REQUIRED');
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return fail(res, 401, '邮箱或密码错误', 'AUTH_INVALID_CREDENTIALS');
        }

        const token = issueToken(user.id);
        return res.json({ success: true, token, user: { id: user.id, email: user.email } });
    } catch (err) {
        return fail(res, 500, err.message, 'AUTH_ADMIN_LOGIN_FAILED');
    }
});

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
        if (!token) {
            return fail(res, 401, 'Missing bearer token', 'AUTH_TOKEN_MISSING');
        }
        const payload = jwt.verify(token, config.jwtSecret);
        const result = await pool.query(
            `SELECT id, email, license_key, created_at, COALESCE(role, 'user') AS role FROM users WHERE id = $1 LIMIT 1`,
            [payload.uid]
        );
        const user = result.rows[0];
        if (!user) {
            return fail(res, 404, 'user not found', 'AUTH_USER_NOT_FOUND');
        }
        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email || '',
                licenseKey: user.license_key || '',
                createdAt: user.created_at,
                role: user.role || 'user',
            },
        });
    } catch (_err) {
        return fail(res, 401, 'Invalid token', 'AUTH_TOKEN_INVALID');
    }
});

module.exports = router;
