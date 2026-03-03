const express = require('express');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRes = await pool.query(
            `SELECT id, email, license_key, created_at FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );
        const profileRes = await pool.query(
            `SELECT display_name, avatar_url, bio, updated_at FROM user_profiles WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        const user = userRes.rows[0];
        const profile = profileRes.rows[0] || {};
        if (!user) {
            return res.status(404).json({ success: false, error: 'user not found' });
        }
        return res.json({
            success: true,
            profile: {
                id: user.id,
                email: user.email || '',
                licenseKey: user.license_key || '',
                displayName: profile.display_name || '',
                avatarUrl: profile.avatar_url || '',
                bio: profile.bio || '',
                createdAt: user.created_at,
                updatedAt: profile.updated_at || null,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/', authRequired, async (req, res) => {
    try {
        const userId = req.user.id;
        const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
        const avatarUrl = String(req.body?.avatarUrl || '').trim().slice(0, 500);
        const bio = String(req.body?.bio || '').trim().slice(0, 1000);

        await pool.query(
            `
            INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                bio = EXCLUDED.bio,
                updated_at = NOW()
            `,
            [userId, displayName, avatarUrl, bio]
        );

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
