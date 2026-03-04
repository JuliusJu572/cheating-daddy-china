const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const pool = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { createResume, listResumesByUser } = require('../services/resumeService');
const { decryptLicenseKey } = require('../utils/decryptLicense');

const router = express.Router();

if (!fs.existsSync(config.uploadDirAbs)) {
    fs.mkdirSync(config.uploadDirAbs, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDirAbs),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ext === '.pdf' || ext === '.docx' ? ext : '';
        cb(null, `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
    },
});

function fixFilenameEncoding(name) {
    if (!name || typeof name !== 'string') return name;
    try {
        return Buffer.from(name, 'latin1').toString('utf8');
    } catch {
        return name;
    }
}

const upload = multer({
    storage,
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (req, file, cb) => {
        file.originalname = fixFilenameEncoding(file.originalname) || file.originalname;
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext !== '.pdf' && ext !== '.docx') {
            return cb(new Error('Only .pdf and .docx are allowed'));
        }
        return cb(null, true);
    },
});

router.post('/upload', authRequired, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'resume file is required' });
        }
        let modelApiKey = null;
        const userRow = await pool.query(
            `SELECT license_key FROM users WHERE id = $1 LIMIT 1`,
            [req.user.id]
        );
        const licenseKey = userRow.rows[0]?.license_key;
        if (licenseKey) {
            const dec = decryptLicenseKey(licenseKey);
            if (dec.success && dec.apiKey) modelApiKey = dec.apiKey;
        }
        const row = await createResume({
            userId: req.user.id,
            filePath: req.file.path,
            originalFilename: req.file.originalname || 'resume',
            mimetype: req.file.mimetype,
            modelApiKey,
        });
        return res.json({ success: true, resume: row });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/list', authRequired, async (req, res) => {
    try {
        const rows = await listResumesByUser(req.user.id);
        return res.json({ success: true, resumes: rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/item/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const result = await pool.query(
            `SELECT * FROM resumes WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'resume not found' });
        }
        return res.json({ success: true, resume: result.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/item/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const { analyzedContent } = req.body;
        if (typeof analyzedContent !== 'string') {
            return res.status(400).json({ success: false, error: 'analyzedContent must be a string' });
        }
        const updated = await pool.query(
            `
            UPDATE resumes
            SET analyzed_content = $1
            WHERE id = $2 AND user_id = $3
            RETURNING *
            `,
            [analyzedContent, id, req.user.id]
        );
        if (updated.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'resume not found' });
        }
        return res.json({ success: true, resume: updated.rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/item/:id', authRequired, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, error: 'invalid id' });
        }
        const deleted = await pool.query(
            `
            DELETE FROM resumes
            WHERE id = $1 AND user_id = $2
            RETURNING file_path
            `,
            [id, req.user.id]
        );
        if (deleted.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'resume not found' });
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
