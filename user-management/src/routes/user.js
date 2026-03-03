const express = require('express');
const { authRequired } = require('../middleware/auth');
const { getLatestResumeContextByUser } = require('../services/resumeService');

const router = express.Router();

router.get('/resume-context', authRequired, async (req, res) => {
    try {
        const context = await getLatestResumeContextByUser(req.user.id);
        return res.json({ success: true, ...context });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
