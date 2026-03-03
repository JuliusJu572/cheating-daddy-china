const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const resumeRoutes = require('./routes/resume');
const profileRoutes = require('./routes/profile');
const voiceRoutes = require('./routes/voice');
const sessionRoutes = require('./routes/sessions');

if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is required');
}

if (!fs.existsSync(config.uploadDirAbs)) {
    fs.mkdirSync(config.uploadDirAbs, { recursive: true });
}

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ success: true, service: 'user-management', db: 'ok' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.use('/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/sessions', sessionRoutes);

const webRoot = path.resolve(__dirname, '../web');
if (fs.existsSync(webRoot)) {
    app.use('/', express.static(webRoot));
}

app.listen(config.port, () => {
    console.log(`user-management listening on :${config.port}`);
});
