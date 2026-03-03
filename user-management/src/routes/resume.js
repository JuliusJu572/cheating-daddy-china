const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { authRequired } = require('../middleware/auth');
const { createResume, listResumesByUser } = require('../services/resumeService');

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

const upload = multer({
    storage,
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (_req, file, cb) => {
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
        const row = await createResume({
            userId: req.user.id,
            filePath: req.file.path,
            originalFilename: req.file.originalname || 'resume',
            mimetype: req.file.mimetype,
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

module.exports = router;
