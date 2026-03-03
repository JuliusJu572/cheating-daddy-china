const jwt = require('jsonwebtoken');
const config = require('../config');

function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

    if (!token) {
        return res.status(401).json({ success: false, error: 'Missing bearer token' });
    }

    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.user = { id: payload.uid };
        return next();
    } catch (_err) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}

module.exports = { authRequired };
