const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/resume-context', authRequired, async (_req, res) => {
    // 简历内容已迁移至客户端本地存储，此接口保持兼容，返回空 context
    return res.json({ success: true, context: '' });
});

module.exports = router;
