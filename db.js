const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');


let db;


async function initDb() {
db = await open({ filename: path.join(__dirname, 'data.sqlite'), driver: sqlite3.Database });


// Users: id, email(unique), passwordHash, role, otpSecret (demo), createdAt
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
email TEXT UNIQUE NOT NULL,
passwordHash TEXT NOT NULL,
role TEXT NOT NULL DEFAULT 'customer',
otpSecret TEXT,
createdAt TEXT NOT NULL
);
`);


// Products
await db.exec(`
CREATE TABLE IF NOT EXISTS products (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
description TEXT,
price_cents INTEGER NOT NULL,
stock INTEGER NOT NULL DEFAULT 0
);
`);


// Orders
await db.exec(`
CREATE TABLE IF NOT EXISTS orders (
id TEXT PRIMARY KEY,
userId TEXT NOT NULL,
items TEXT NOT NULL, -- JSON string
amount_cents INTEGER NOT NULL,
paid INTEGER NOT NULL DEFAULT 0,
createdAt TEXT NOT NULL,
FOREIGN KEY (userId) REFERENCES users(id)
);
`);


// Simple audit log
await db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
id TEXT PRIMARY KEY,
event TEXT NOT NULL,
meta TEXT,
createdAt TEXT NOT NULL
);
`);
}


function getDb() { if (!db) throw new Error('DB not initialized'); return db; }


module.exports = { initDb, getDb };