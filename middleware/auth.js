const jwt = require('jsonwebtoken');
const { getDb } = require('../db');


const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';


function generateToken(user) {
const payload = { id: user.id, email: user.email, role: user.role };
return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
}


async function authMiddleware(req, res, next) {
const auth = req.headers.authorization;
if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
const token = auth.split(' ')[1];
try {
const payload = jwt.verify(token, JWT_SECRET);
// attach fresh user info from DB
const db = getDb();
const user = await db.get('SELECT id, email, role FROM users WHERE id = ?', [payload.id]);
if (!user) return res.status(401).json({ error: 'invalid user' });
req.user = user;
next();
} catch (e) {
return res.status(401).json({ error: 'invalid token' });
}
}


function requireRole(role) {
return (req, res, next) => {
if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
if (req.user.role !== role) return res.status(403).json({ error: 'forbidden' });
next();
};
}


module.exports = { authMiddleware, requireRole, generateToken };