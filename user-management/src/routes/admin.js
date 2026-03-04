const express = require('express');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');

const router = express.Router();

router.get('/stats', authRequired, adminRequired, async (_req, res) => {
    try {
        const [userCount, resumeCount, voiceCount, sessionCount, tokenCount] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS n FROM users'),
            pool.query('SELECT COUNT(*)::int AS n FROM resumes'),
            pool.query('SELECT COUNT(*)::int AS n FROM voice_recordings'),
            pool.query('SELECT COUNT(*)::int AS n FROM interview_sessions'),
            pool.query('SELECT COALESCE(SUM(total_tokens), 0)::bigint AS n FROM token_usage'),
        ]);
        return res.json({
            success: true,
            stats: {
                users: userCount.rows[0]?.n ?? 0,
                resumes: resumeCount.rows[0]?.n ?? 0,
                voices: voiceCount.rows[0]?.n ?? 0,
                sessions: sessionCount.rows[0]?.n ?? 0,
                totalTokens: Number(tokenCount.rows[0]?.n ?? 0),
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/users', authRequired, adminRequired, async (_req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT u.id, u.email, u.license_key, u.created_at, COALESCE(u.role, 'user') AS role,
                   COALESCE(u.quota_tokens, 1000000)::bigint AS quota_tokens,
                   COALESCE(u.frozen, FALSE) AS frozen,
                   (SELECT COUNT(*)::int FROM resumes r WHERE r.user_id = u.id) AS resume_count,
                   (SELECT COUNT(*)::int FROM voice_recordings v WHERE v.user_id = u.id) AS voice_count,
                   (SELECT COUNT(*)::int FROM interview_sessions s WHERE s.user_id = u.id) AS session_count,
                   (SELECT COALESCE(SUM(tu.total_tokens), 0)::bigint FROM token_usage tu WHERE tu.user_id = u.id) AS used_tokens
            FROM users u
            ORDER BY u.created_at DESC
            `
        );
        const users = result.rows.map((r) => ({
            id: r.id,
            email: r.email || '-',
            licenseKey: r.license_key ? '***' : '-',
            role: r.role || 'user',
            quotaTokens: Number(r.quota_tokens || 0),
            usedTokens: Number(r.used_tokens || 0),
            frozen: Boolean(r.frozen),
            createdAt: r.created_at,
            resumeCount: r.resume_count ?? 0,
            voiceCount: r.voice_count ?? 0,
            sessionCount: r.session_count ?? 0,
        }));
        return res.json({ success: true, users });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
