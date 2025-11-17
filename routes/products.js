const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLogger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /products
 * List all products
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const products = await db.all('SELECT id, name, description, price_cents, stock FROM products');
    res.json(products);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /products
 * Add a new product (admin only)
 */
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  [
    body('name').isString().notEmpty(),
    body('description').isString().optional(),
    body('price_cents').isInt({ min: 0 }),
    body('stock').isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const { name, description, price_cents, stock } = req.body;
      const db = getDb();
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      await db.run(
        'INSERT INTO products (id, name, description, price_cents, stock, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description || '', price_cents, stock, createdAt]
      );

      auditLogger('product_created', { userId: req.user.id, productId: id });
      res.json({ message: 'Product created', productId: id });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /products/:id
 * Update a product (admin only)
 */
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  [
    body('name').isString().optional(),
    body('description').isString().optional(),
    body('price_cents').isInt({ min: 0 }).optional(),
    body('stock').isInt({ min: 0 }).optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const { id } = req.params;
      const updates = req.body;
      const db = getDb();

      const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      // Build update query dynamically
      const fields = [];
      const values = [];
      for (const key of ['name', 'description', 'price_cents', 'stock']) {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      }
      values.push(id);

      await db.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);

      auditLogger('product_updated', { userId: req.user.id, productId: id });
      res.json({ message: 'Product updated' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /products/:id
 * Delete a product (admin only)
 */
router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const db = getDb();

      const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      await db.run('DELETE FROM products WHERE id = ?', [id]);

      auditLogger('product_deleted', { userId: req.user.id, productId: id });
      res.json({ message: 'Product deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ✅ Export the router correctly
module.exports = router;
