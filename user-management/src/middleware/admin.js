const pool = require('../db/pool');

async function adminRequired(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Missing bearer token' });
    }
    try {
        const result = await pool.query(
            `SELECT id, email, COALESCE(role, 'user') AS role FROM users WHERE id = $1 LIMIT 1`,
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin only' });
        }
        req.user.role = user.role;
        req.user.email = user.email;
        return next();
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}

module.exports = { adminRequired };
