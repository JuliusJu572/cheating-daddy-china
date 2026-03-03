const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');

const router = express.Router();

function fail(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function issueToken(userId) {
    return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email/password required', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, 'invalid email format', 'AUTH_INVALID_EMAIL');
        }
        if (password.length < 8) {
            return fail(res, 400, 'password must be at least 8 chars', 'AUTH_WEAK_PASSWORD');
        }
        const hash = await bcrypt.hash(password, 10);
        const inserted = await pool.query(
            `
            INSERT INTO users(email, password_hash)
            VALUES ($1, $2)
            RETURNING id, email, created_at
            `,
            [email, hash]
        );
        const user = inserted.rows[0];
        const token = issueToken(user.id);
        return res.json({ success: true, token, user });
    } catch (err) {
        if (err?.code === '23505') {
            return fail(res, 409, 'email already exists', 'AUTH_EMAIL_EXISTS');
        }
        return fail(res, 500, err.message, 'AUTH_REGISTER_FAILED');
    }
});

router.post('/login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return fail(res, 400, 'email/password required', 'AUTH_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, 'invalid email format', 'AUTH_INVALID_EMAIL');
        }
        const result = await pool.query(
            `SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1`,
            [email]
        );
        const user = result.rows[0];
        if (!user || !user.password_hash) {
            return fail(res, 401, 'invalid credentials', 'AUTH_INVALID_CREDENTIALS');
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return fail(res, 401, 'invalid credentials', 'AUTH_INVALID_CREDENTIALS');
        const token = issueToken(user.id);
        return res.json({ success: true, token, user: { id: user.id, email: user.email } });
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

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
        if (!token) {
            return fail(res, 401, 'Missing bearer token', 'AUTH_TOKEN_MISSING');
        }
        const payload = jwt.verify(token, config.jwtSecret);
        const result = await pool.query(
            `SELECT id, email, license_key, created_at FROM users WHERE id = $1 LIMIT 1`,
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
            },
        });
    } catch (_err) {
        return fail(res, 401, 'Invalid token', 'AUTH_TOKEN_INVALID');
    }
});

module.exports = router;
