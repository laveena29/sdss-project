const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Logs important security and user actions to DB (audit trail).
 * 
 * @param {string} event - Short name of the event (e.g., "login_success")
 * @param {object} meta - Any extra data (userId, ip, etc.)
 */
async function auditLogger(event, meta = {}) {
  try {
    const db = getDb();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO audit_logs (id, event, meta, createdAt) VALUES (?, ?, ?, ?)',
      [id, event, JSON.stringify(meta), createdAt]
    );
  } catch (e) {
    console.error('auditLogger error:', e);
  }
}

module.exports = { auditLogger };
