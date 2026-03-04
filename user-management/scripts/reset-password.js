#!/usr/bin/env node
/**
 * 重置指定邮箱的管理员密码
 * 用法: node scripts/reset-password.js <email> <newPassword>
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

const email = (process.argv[2] || '').trim().toLowerCase();
const newPassword = process.argv[3] || '';

async function main() {
    if (!email || !newPassword) {
        console.error('用法: node scripts/reset-password.js <email> <newPassword>');
        process.exit(1);
    }
    if (newPassword.length < 6) {
        console.error('密码至少 6 位');
        process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
        `UPDATE users SET password_hash = $1, role = 'admin', updated_at = NOW()
         WHERE LOWER(TRIM(email)) = $2
         RETURNING id, email, role`,
        [hash, email]
    );

    if (result.rowCount === 0) {
        const inserted = await pool.query(
            `INSERT INTO users(email, password_hash, role) VALUES($1, $2, 'admin')
             ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'admin', updated_at = NOW()
             RETURNING id, email, role`,
            [email, hash]
        );
        if (inserted.rowCount > 0) {
            console.log('用户不存在，已创建并设置密码:', inserted.rows[0].email);
        }
    } else {
        console.log('密码已重置:', result.rows[0].email);
    }
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
