const express = require('express');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, async (req, res) => {
    try {
        const profileType = String(req.body?.profileType || 'interview').trim();
        const language = String(req.body?.language || 'zh-CN').trim();
        const title = String(req.body?.title || '').trim().slice(0, 200);
        const inserted = await pool.query(
            `
            INSERT INTO interview_sessions (user_id, profile_type, language, title, status, started_at, updated_at)
            VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
            RETURNING id, user_id, profile_type, language, title, status, started_at, ended_at, total_turns, created_at, updated_at
            `,
            [req.user.id, profileType, language, title]
        );
        return res.json({ success: true, session: inserted.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const status = String(req.body?.status || '').trim();
        const endedAt = req.body?.endedAt ? new Date(req.body.endedAt) : null;
        const totalTurns = Math.max(0, parseInt(req.body?.totalTurns || '0', 10) || 0);
        const updated = await pool.query(
            `
            UPDATE interview_sessions
            SET
                status = CASE WHEN $3 <> '' THEN $3 ELSE status END,
                ended_at = COALESCE($4, ended_at),
                total_turns = CASE WHEN $5 > 0 THEN $5 ELSE total_turns END,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING id, user_id, profile_type, language, title, status, started_at, ended_at, total_turns, created_at, updated_at
            `,
            [id, req.user.id, status, endedAt, totalTurns]
        );
        if (updated.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'session not found' });
        }
        return res.json({ success: true, session: updated.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/:id/responses', authRequired, async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        if (!Number.isFinite(sessionId)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const turnIndex = Math.max(0, parseInt(req.body?.turnIndex || '0', 10) || 0);
        const questionText = String(req.body?.questionText || '').trim();
        const answerText = String(req.body?.answerText || '').trim();
        const screenshotPath = String(req.body?.screenshotPath || '').trim();

        const hasSession = await pool.query(
            `SELECT id FROM interview_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [sessionId, req.user.id]
        );
        if (hasSession.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'session not found' });
        }

        const inserted = await pool.query(
            `
            INSERT INTO interview_responses (session_id, user_id, turn_index, question_text, answer_text, screenshot_path)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, session_id, user_id, turn_index, question_text, answer_text, screenshot_path, created_at
            `,
            [sessionId, req.user.id, turnIndex, questionText, answerText, screenshotPath]
        );

        return res.json({ success: true, response: inserted.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT id, user_id, profile_type, language, title, status, started_at, ended_at, total_turns, created_at, updated_at
            FROM interview_sessions
            WHERE user_id = $1
            ORDER BY created_at DESC
            `,
            [req.user.id]
        );
        return res.json({ success: true, sessions: result.rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const sessionRes = await pool.query(
            `
            SELECT id, user_id, profile_type, language, title, status, started_at, ended_at, total_turns, created_at, updated_at
            FROM interview_sessions
            WHERE id = $1 AND user_id = $2
            LIMIT 1
            `,
            [id, req.user.id]
        );
        const session = sessionRes.rows[0];
        if (!session) {
            return res.status(404).json({ success: false, error: 'session not found' });
        }
        const responsesRes = await pool.query(
            `
            SELECT id, session_id, user_id, turn_index, question_text, answer_text, screenshot_path, created_at
            FROM interview_responses
            WHERE session_id = $1 AND user_id = $2
            ORDER BY turn_index ASC, created_at ASC
            `,
            [id, req.user.id]
        );
        return res.json({ success: true, session, responses: responsesRes.rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
