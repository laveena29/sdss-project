const rateLimit = require('express-rate-limit');


function createLimiter(options) {
return rateLimit({
windowMs: options.windowMs || 60 * 1000,
max: options.max || 10,
message: options.message || 'Too many requests, try later',
standardHeaders: true,
legacyHeaders: false,
});
}


module.exports = { createLimiter };