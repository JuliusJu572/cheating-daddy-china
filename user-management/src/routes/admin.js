const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');

const router = express.Router();

function fail(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function writeAdminAuditLog(client, payload) {
    await client.query(
        `
        INSERT INTO admin_audit_logs (
            admin_user_id, admin_email, action, target_user_id, target_email, detail
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
            payload.adminUserId,
            payload.adminEmail || '',
            payload.action,
            payload.targetUserId || null,
            payload.targetEmail || '',
            JSON.stringify(payload.detail || {}),
        ]
    );
}

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

router.post('/users', authRequired, adminRequired, async (req, res) => {
    let client = null;
    try {
        client = await pool.connect();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const role = String(req.body?.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
        const quotaTokensRaw = Number(req.body?.quota_tokens);
        const quotaTokens = Number.isFinite(quotaTokensRaw) && quotaTokensRaw >= 0 ? Math.floor(quotaTokensRaw) : 1000000;
        const frozen = Boolean(req.body?.frozen);

        if (!email || !password) {
            return fail(res, 400, 'email 和 password 必填', 'ADMIN_USER_MISSING_FIELDS');
        }
        if (!validateEmail(email)) {
            return fail(res, 400, '邮箱格式无效', 'ADMIN_USER_INVALID_EMAIL');
        }
        if (password.length < 8) {
            return fail(res, 400, '密码至少 8 位', 'ADMIN_USER_WEAK_PASSWORD');
        }

        await client.query('BEGIN');
        const hash = await bcrypt.hash(password, 8);
        const inserted = await client.query(
            `
            INSERT INTO users(email, password_hash, role, quota_tokens, frozen)
            VALUES($1, $2, $3, $4::bigint, $5)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email, COALESCE(role, 'user') AS role, quota_tokens, frozen, created_at
            `,
            [email, hash, role, quotaTokens, frozen]
        );
        if (inserted.rowCount === 0) {
            await client.query('ROLLBACK');
            return fail(res, 409, '该邮箱已存在', 'ADMIN_USER_EMAIL_EXISTS');
        }

        const user = inserted.rows[0];
        await writeAdminAuditLog(client, {
            adminUserId: req.user.id,
            adminEmail: req.user.email || '',
            action: 'create_user',
            targetUserId: user.id,
            targetEmail: user.email || '',
            detail: {
                role: user.role || 'user',
                quotaTokens: Number(user.quota_tokens || 0),
                frozen: Boolean(user.frozen),
            },
        });
        await client.query('COMMIT');
        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email || '',
                role: user.role || 'user',
                quotaTokens: Number(user.quota_tokens || 0),
                frozen: Boolean(user.frozen),
                createdAt: user.created_at,
            },
        });
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (_e) {}
        }
        return fail(res, 500, err.message, 'ADMIN_CREATE_USER_FAILED');
    } finally {
        if (client) client.release();
    }
});

router.delete('/users/:userId', authRequired, adminRequired, async (req, res) => {
    let client = null;
    try {
        client = await pool.connect();
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return fail(res, 400, 'invalid userId', 'INVALID_USER_ID');
        }
        if (userId === Number(req.user.id)) {
            return fail(res, 400, '不能删除当前登录管理员', 'ADMIN_DELETE_SELF_FORBIDDEN');
        }

        await client.query('BEGIN');
        const targetRes = await client.query(
            `SELECT id, email, COALESCE(role, 'user') AS role FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );
        if (targetRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return fail(res, 404, 'user not found', 'USER_NOT_FOUND');
        }
        const target = targetRes.rows[0];
        if (target.role === 'admin') {
            await client.query('ROLLBACK');
            return fail(res, 400, '不允许删除管理员账号', 'ADMIN_DELETE_ADMIN_FORBIDDEN');
        }

        await writeAdminAuditLog(client, {
            adminUserId: req.user.id,
            adminEmail: req.user.email || '',
            action: 'delete_user',
            targetUserId: target.id,
            targetEmail: target.email || '',
            detail: {
                role: target.role || 'user',
            },
        });
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await client.query('COMMIT');
        return res.json({ success: true });
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (_e) {}
        }
        return fail(res, 500, err.message, 'ADMIN_DELETE_USER_FAILED');
    } finally {
        if (client) client.release();
    }
});

router.get('/audit-logs', authRequired, adminRequired, async (req, res) => {
    try {
        const limitRaw = Number(req.query?.limit);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 100;
        const result = await pool.query(
            `
            SELECT
                id,
                admin_user_id,
                admin_email,
                action,
                target_user_id,
                target_email,
                detail,
                created_at
            FROM admin_audit_logs
            ORDER BY created_at DESC
            LIMIT $1
            `,
            [limit]
        );
        return res.json({
            success: true,
            logs: result.rows.map((row) => ({
                id: row.id,
                adminUserId: row.admin_user_id,
                adminEmail: row.admin_email || '',
                action: row.action || '',
                targetUserId: row.target_user_id,
                targetEmail: row.target_email || '',
                detail: row.detail || {},
                createdAt: row.created_at,
            })),
        });
    } catch (err) {
        return fail(res, 500, err.message, 'ADMIN_AUDIT_LOGS_FAILED');
    }
});

module.exports = router;
