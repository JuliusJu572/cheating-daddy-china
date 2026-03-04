const express = require('express');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');

const router = express.Router();

function fail(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

router.get('/summary', authRequired, adminRequired, async (_req, res) => {
    try {
        const [totalsRes, usersRes] = await Promise.all([
            pool.query(
                `
                SELECT
                    COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
                    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
                FROM token_usage
                `
            ),
            pool.query(
                `
                SELECT
                    u.id,
                    u.email,
                    COALESCE(u.role, 'user') AS role,
                    COALESCE(u.quota_tokens, 1000000)::bigint AS quota_tokens,
                    COALESCE(u.frozen, FALSE) AS frozen,
                    COALESCE(SUM(tu.total_tokens), 0)::bigint AS used_tokens
                FROM users u
                LEFT JOIN token_usage tu ON tu.user_id = u.id
                GROUP BY u.id, u.email, u.role, u.quota_tokens, u.frozen
                ORDER BY used_tokens DESC, u.created_at DESC
                `
            ),
        ]);

        const totals = totalsRes.rows[0] || {};
        const users = usersRes.rows.map(row => ({
            id: row.id,
            email: row.email || '-',
            role: row.role || 'user',
            quotaTokens: Number(row.quota_tokens || 0),
            usedTokens: Number(row.used_tokens || 0),
            frozen: Boolean(row.frozen),
        }));

        return res.json({
            success: true,
            totals: {
                promptTokens: Number(totals.prompt_tokens || 0),
                completionTokens: Number(totals.completion_tokens || 0),
                totalTokens: Number(totals.total_tokens || 0),
            },
            users,
        });
    } catch (error) {
        return fail(res, 500, error.message, 'USAGE_SUMMARY_FAILED');
    }
});

router.get('/detail/:userId', authRequired, adminRequired, async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return fail(res, 400, 'invalid userId', 'INVALID_USER_ID');
        }

        const [dailyRes, byTypeRes] = await Promise.all([
            pool.query(
                `
                SELECT
                    to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
                FROM token_usage
                WHERE user_id = $1
                GROUP BY date_trunc('day', created_at)
                ORDER BY day DESC
                LIMIT 60
                `,
                [userId]
            ),
            pool.query(
                `
                SELECT
                    call_type,
                    COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
                    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
                FROM token_usage
                WHERE user_id = $1
                GROUP BY call_type
                ORDER BY total_tokens DESC
                `,
                [userId]
            ),
        ]);

        return res.json({
            success: true,
            daily: dailyRes.rows.map(r => ({
                day: r.day,
                totalTokens: Number(r.total_tokens || 0),
            })),
            byType: byTypeRes.rows.map(r => ({
                callType: r.call_type,
                promptTokens: Number(r.prompt_tokens || 0),
                completionTokens: Number(r.completion_tokens || 0),
                totalTokens: Number(r.total_tokens || 0),
            })),
        });
    } catch (error) {
        return fail(res, 500, error.message, 'USAGE_DETAIL_FAILED');
    }
});

router.put('/quota/:userId', authRequired, adminRequired, async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const quotaTokens = Number(req.body?.quota_tokens);
        if (!Number.isFinite(userId) || userId <= 0) {
            return fail(res, 400, 'invalid userId', 'INVALID_USER_ID');
        }
        if (!Number.isFinite(quotaTokens) || quotaTokens < 0) {
            return fail(res, 400, 'quota_tokens must be >= 0', 'INVALID_QUOTA');
        }

        const result = await pool.query(
            `
            UPDATE users
            SET quota_tokens = $2::bigint,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, quota_tokens, frozen
            `,
            [userId, Math.floor(quotaTokens)]
        );
        if (result.rowCount === 0) {
            return fail(res, 404, 'user not found', 'USER_NOT_FOUND');
        }
        const row = result.rows[0];
        return res.json({
            success: true,
            user: {
                id: row.id,
                quotaTokens: Number(row.quota_tokens || 0),
                frozen: Boolean(row.frozen),
            },
        });
    } catch (error) {
        return fail(res, 500, error.message, 'USAGE_SET_QUOTA_FAILED');
    }
});

router.put('/freeze/:userId', authRequired, adminRequired, async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const frozen = Boolean(req.body?.frozen);
        if (!Number.isFinite(userId) || userId <= 0) {
            return fail(res, 400, 'invalid userId', 'INVALID_USER_ID');
        }

        const result = await pool.query(
            `
            UPDATE users
            SET frozen = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, quota_tokens, frozen
            `,
            [userId, frozen]
        );
        if (result.rowCount === 0) {
            return fail(res, 404, 'user not found', 'USER_NOT_FOUND');
        }
        const row = result.rows[0];
        return res.json({
            success: true,
            user: {
                id: row.id,
                quotaTokens: Number(row.quota_tokens || 0),
                frozen: Boolean(row.frozen),
            },
        });
    } catch (error) {
        return fail(res, 500, error.message, 'USAGE_SET_FROZEN_FAILED');
    }
});

module.exports = router;
