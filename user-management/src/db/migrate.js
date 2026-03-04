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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL DEFAULT '',
            avatar_url TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS voice_recordings (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            mimetype TEXT NOT NULL DEFAULT '',
            duration_sec INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'mic',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_voice_recordings_user_created_at
        ON voice_recordings(user_id, created_at DESC);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            profile_type TEXT NOT NULL DEFAULT 'interview',
            language TEXT NOT NULL DEFAULT 'zh-CN',
            title TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMPTZ,
            total_turns INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created_at
        ON interview_sessions(user_id, created_at DESC);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS interview_responses (
            id BIGSERIAL PRIMARY KEY,
            session_id BIGINT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            turn_index INTEGER NOT NULL DEFAULT 0,
            question_text TEXT NOT NULL DEFAULT '',
            answer_text TEXT NOT NULL DEFAULT '',
            screenshot_path TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_interview_responses_session_turn
        ON interview_responses(session_id, turn_index DESC);
    `);

    await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
    `);

    await pool.query(`
        UPDATE users SET role = 'admin' WHERE LOWER(TRIM(email)) = '1272959954@qq.com';
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
