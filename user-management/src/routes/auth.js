const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');

const router = express.Router();

function issueToken(userId) {
    return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'email/password required' });
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
        if (String(err?.message || '').includes('duplicate')) {
            return res.status(409).json({ success: false, error: 'email already exists' });
        }
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const result = await pool.query(
            `SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1`,
            [email]
        );
        const user = result.rows[0];
        if (!user || !user.password_hash) {
            return res.status(401).json({ success: false, error: 'invalid credentials' });
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ success: false, error: 'invalid credentials' });
        const token = issueToken(user.id);
        return res.json({ success: true, token, user: { id: user.id, email: user.email } });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/license', async (req, res) => {
    try {
        const licenseKey = String(req.body?.licenseKey || '').trim();
        if (!licenseKey) {
            return res.status(400).json({ success: false, error: 'licenseKey required' });
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
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
