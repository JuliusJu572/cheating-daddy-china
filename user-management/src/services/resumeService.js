const fs = require('node:fs');
const path = require('node:path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const pool = require('../db/pool');
const { analyzeResume } = require('./resumeAnalyzer');

async function extractTextFromFile(filePath, mimetype) {
    const fileBuffer = fs.readFileSync(filePath);

    if (mimetype === 'application/pdf' || path.extname(filePath).toLowerCase() === '.pdf') {
        const parsed = await pdfParse(fileBuffer);
        return String(parsed?.text || '').trim();
    }

    if (
        mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        path.extname(filePath).toLowerCase() === '.docx'
    ) {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return String(result?.value || '').trim();
    }

    throw new Error('Only pdf/docx files are supported');
}

async function createResume({ userId, filePath, originalFilename, mimetype }) {
    const rawText = await extractTextFromFile(filePath, mimetype);
    if (!rawText) throw new Error('Resume text extraction returned empty content');

    const analyzedContent = await analyzeResume(rawText);
    const inserted = await pool.query(
        `
        INSERT INTO resumes (user_id, file_path, original_filename, raw_text, analyzed_content)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, original_filename, analyzed_content, created_at
        `,
        [userId, filePath, originalFilename, rawText, analyzedContent]
    );
    return inserted.rows[0];
}

async function listResumesByUser(userId) {
    const result = await pool.query(
        `
        SELECT id, user_id, original_filename, analyzed_content, created_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
    );
    return result.rows;
}

async function getLatestResumeContextByUser(userId) {
    const result = await pool.query(
        `
        SELECT analyzed_content, created_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId]
    );
    const row = result.rows[0];
    return {
        context: String(row?.analyzed_content || '').trim(),
        updatedAt: row?.created_at || null,
    };
}

module.exports = {
    createResume,
    listResumesByUser,
    getLatestResumeContextByUser,
};
