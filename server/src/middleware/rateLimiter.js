const rateLimit = require('express-rate-limit');

// Rate limit cho login - chống brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 attempts
  message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit theo cả IP và email
    return req.body.email ? `${req.ip}-${req.body.email}` : req.ip;
  }
});

// Rate limit cho register
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // 3 tài khoản/IP/giờ
  message: 'Quá nhiều tài khoản được tạo. Vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cho refresh token
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // 10 refresh/15 phút
  message: 'Quá nhiều yêu cầu làm mới token.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit chung cho API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // 100 requests/15 phút
  message: 'Quá nhiều yêu cầu từ IP này.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  apiLimiter
};
