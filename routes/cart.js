const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { auditLogger } = require('../utils/logger');

const router = express.Router();

/**
 * Save cart as an "order draft" (not yet paid)
 */
router.post(
  '/',
  authMiddleware,
  [body('items').isArray({ min: 1 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const db = getDb();
      const { items } = req.body; // array of { productId, qty }

      // Validate products
      for (const it of items) {
        if (!it.productId || !Number.isInteger(it.qty) || it.qty <= 0) {
          return res.status(400).json({ error: 'invalid item format' });
        }
        const p = await db.get('SELECT id, stock FROM products WHERE id = ?', [
          it.productId,
        ]);
        if (!p) return res.status(400).json({ error: `product not found: ${it.productId}` });
        if (it.qty > p.stock)
          return res
            .status(400)
            .json({ error: `not enough stock for ${it.productId}` });
      }

      // Calculate total
      let amount = 0;
      for (const it of items) {
        const p = await db.get(
          'SELECT price_cents FROM products WHERE id = ?',
          [it.productId]
        );
        amount += p.price_cents * it.qty;
      }

      const orderId = uuidv4();
      await db.run(
        'INSERT INTO orders (id, userId, items, amount_cents, paid, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          orderId,
          req.user.id,
          JSON.stringify(items),
          amount,
          0,
          new Date().toISOString(),
        ]
      );

      auditLogger('cart_saved', { userId: req.user.id, orderId });
      res.json({ orderId, amount_cents: amount });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Get all carts/orders of logged-in user
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.all(
      'SELECT id, items, amount_cents, paid, createdAt FROM orders WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );
    res.json(rows.map((r) => ({ ...r, items: JSON.parse(r.items) })));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
