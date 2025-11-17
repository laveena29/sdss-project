const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { auditLogger } = require('../utils/logger');

// Simple in-memory OTP storage (for demo; replace with SMS/email in production)
const OTP_STORE = new Map();

const router = express.Router();

/**
 * Step 1: Initiate Payment — Generate OTP
 */
router.post(
  '/pay',
  authMiddleware,
  [body('orderId').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const { orderId } = req.body;
      const db = getDb();

      const order = await db.get(
        'SELECT * FROM orders WHERE id = ? AND userId = ?',
        [orderId, req.user.id]
      );
      if (!order) return res.status(404).json({ error: 'order not found' });
      if (order.paid) return res.status(400).json({ error: 'already paid' });

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
      OTP_STORE.set(orderId, { otp, expiresAt });

      auditLogger('payment_initiated', { userId: req.user.id, orderId });

      // Demo only: return masked OTP
      res.json({
        message: 'OTP sent',
        otpMasked: `****${otp.slice(-2)}`,
        demo_otp: otp, // remove in production
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Step 2: Verify OTP and Confirm Payment
 */
router.post(
  '/verify',
  authMiddleware,
  [body('orderId').isString().notEmpty(), body('otp').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const { orderId, otp } = req.body;
      const storedOtp = OTP_STORE.get(orderId);

      if (!storedOtp)
        return res.status(400).json({ error: 'OTP not found or expired' });

      if (Date.now() > storedOtp.expiresAt) {
        OTP_STORE.delete(orderId);
        return res.status(400).json({ error: 'OTP expired' });
      }

      if (storedOtp.otp !== otp)
        return res.status(400).json({ error: 'Invalid OTP' });

      const db = getDb();
      await db.run(
        'UPDATE orders SET paid = 1 WHERE id = ? AND userId = ?',
        [orderId, req.user.id]
      );
      OTP_STORE.delete(orderId);

      auditLogger('payment_completed', { userId: req.user.id, orderId });

      res.json({ message: 'Payment successful' });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router; // ✅ important: export router
