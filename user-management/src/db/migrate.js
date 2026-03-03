const pool = require('./pool');

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            license_key TEXT UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (email IS NOT NULL OR license_key IS NOT NULL)
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS resumes (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            raw_text TEXT NOT NULL DEFAULT '',
            analyzed_content TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_resumes_user_created_at
        ON resumes(user_id, created_at DESC);
    `);
}

migrate()
    .then(async () => {
        console.log('Migration completed');
        await pool.end();
    })
    .catch(async err => {
        console.error('Migration failed:', err.message);
        await pool.end();
        process.exit(1);
    });
