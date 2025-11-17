require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const checkoutRoutes = require('./routes/checkout');
const { auditLogger } = require('./utils/logger');


const app = express();
const PORT = process.env.PORT || 4000;


// Basic security headers
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: true })); // tighten in production to allowed origins


// Global rate limiter - protect from brute force/DoS
const globalLimiter = rateLimit({
windowMs: 60 * 1000, // 1 minute
max: 120, // requests per window per IP
standardHeaders: true,
legacyHeaders: false,
});
app.use(globalLimiter);


// Initialize DB and create schema if needed
initDb().then(() => {
console.log('DB initialized');
}).catch(err => { console.error('DB init error', err); process.exit(1); });


// Routes
app.use('/api/auth', authRoutes);
//app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);


// Simple healthcheck
app.get('/health', (req, res) => res.json({ status: 'ok' }));


// Error handler
app.use((err, req, res, next) => {
console.error(err);
auditLogger('server_error', { message: err.message, path: req.path });
res.status(err.status || 500).json({ error: err.message || 'internal server error' });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));