const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const config = require('../config');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const voiceDir = path.join(config.uploadDirAbs, 'voice');

if (!fs.existsSync(voiceDir)) {
    fs.mkdirSync(voiceDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, voiceDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ['.wav', '.mp3', '.webm', '.m4a'].includes(ext) ? ext : '';
        cb(null, `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!['.wav', '.mp3', '.webm', '.m4a'].includes(ext)) {
            return cb(new Error('Only .wav/.mp3/.webm/.m4a are allowed'));
        }
        return cb(null, true);
    },
});

router.post('/upload', authRequired, upload.single('voice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'voice file is required' });
        }
        const durationSec = Math.max(0, parseInt(req.body?.durationSec || '0', 10) || 0);
        const source = String(req.body?.source || 'mic').trim() || 'mic';
        const inserted = await pool.query(
            `
            INSERT INTO voice_recordings (user_id, file_path, original_filename, mimetype, duration_sec, source)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, original_filename, mimetype, duration_sec, source, created_at
            `,
            [
                req.user.id,
                req.file.path,
                req.file.originalname || 'voice',
                req.file.mimetype || '',
                durationSec,
                source,
            ]
        );
        return res.json({ success: true, voice: inserted.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/list', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT id, user_id, original_filename, mimetype, duration_sec, source, created_at
            FROM voice_recordings
            WHERE user_id = $1
            ORDER BY created_at DESC
            `,
            [req.user.id]
        );
        return res.json({ success: true, voices: result.rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/:id/file', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const result = await pool.query(
            `
            SELECT file_path, original_filename, mimetype
            FROM voice_recordings
            WHERE id = $1 AND user_id = $2
            LIMIT 1
            `,
            [id, req.user.id]
        );
        const row = result.rows[0];
        if (!row || !fs.existsSync(row.file_path)) {
            return res.status(404).json({ success: false, error: 'voice not found' });
        }
        const filename = row.original_filename || `voice_${id}`;
        if (row.mimetype) {
            res.setHeader('Content-Type', row.mimetype);
        }
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return fs.createReadStream(row.file_path).pipe(res);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const deleted = await pool.query(
            `
            DELETE FROM voice_recordings
            WHERE id = $1 AND user_id = $2
            RETURNING file_path
            `,
            [id, req.user.id]
        );
        if (deleted.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'voice not found' });
        }
        const filePath = deleted.rows[0].file_path;
        try {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
