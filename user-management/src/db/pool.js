const { Pool } = require('pg');
const config = require('../config');

if (!config.databaseUrl) {
    // Fail fast to avoid silently running without DB connectivity.
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
});

module.exports = pool;
