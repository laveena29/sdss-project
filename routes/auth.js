const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { generateToken } = require('../middleware/auth');
const { auditLogger } = require('../utils/logger');
const { createLimiter } = require('../middleware/ratelimit'); 

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Too many auth attempts',
});

// =============================
// REGISTER
// =============================
router.post(
  '/register',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const db = getDb();

      const exists = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (exists) return res.status(400).json({ error: 'email already registered' });

      const passwordHash = await bcrypt.hash(password, 12);
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await db.run(
        'INSERT INTO users (id, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, email, passwordHash, 'customer', createdAt]
      );

      auditLogger('user_registered', { userId: id, email });
      res.json({ message: 'registered' });
    } catch (e) {
      next(e);
    }
  }
);

// =============================
// LOGIN
// =============================
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 8 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const db = getDb();

      const user = await db.get('SELECT id, email, passwordHash, role FROM users WHERE email = ?', [email]);

      // Use fake hash to prevent timing attacks
      const fakeHash = "$2b$12$C6UzMDM.H6dfI/f/IKxGhuJQ2s1urhR57g4xMqR0ZySPdY9v8Y3Ga"; 

      const match = user
        ? await bcrypt.compare(password, user.passwordHash)
        : await bcrypt.compare(password, fakeHash);

      if (!user || !match) {
        auditLogger('failed_login', { email, ip: req.ip });
        return res.status(401).json({ error: 'invalid credentials' });
      }

      const token = generateToken(user);
      auditLogger('login_success', { userId: user.id, ip: req.ip });
      res.json({ token });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router; 
