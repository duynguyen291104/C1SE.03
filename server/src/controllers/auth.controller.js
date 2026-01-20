const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');

/**
 * Generate access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_EXPIRES || '15m' }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = async (userId, ipAddress = '') => {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiresAt = new Date();
  const days = parseInt(process.env.REFRESH_EXPIRES) || 30;
  expiresAt.setDate(expiresAt.getDate() + days);

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    createdBy: ipAddress
  });

  return token;
};

/**
 * Register new user
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (no role assigned yet)
    const user = await User.create({
      email,
      passwordHash,
      roles: [], // Empty roles initially
      profile: {
        fullName: fullName || '',
        avatarUrl: ''
      }
    });

    // Audit log
    await AuditLog.log({
      userId: user._id,
      action: 'REGISTER',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Audit failed login
      await AuditLog.log({
        userId: user._id,
        action: 'LOGIN_FAILED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failure',
        details: { reason: 'Invalid password' }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id, req.ip);

    // Audit log
    await AuditLog.log({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Refresh access token
 */
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find token in database
    const tokenDoc = await RefreshToken.findOne({ tokenHash });

    if (!tokenDoc || !tokenDoc.isValid()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Revoke old refresh token (rotation)
    tokenDoc.revokedAt = new Date();
    await tokenDoc.save();

    // Generate new tokens
    const accessToken = generateAccessToken(tokenDoc.userId);
    const newRefreshToken = await generateRefreshToken(tokenDoc.userId, req.ip);

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      // Revoke the token
      const tokenDoc = await RefreshToken.findOne({ tokenHash });
      if (tokenDoc) {
        tokenDoc.revokedAt = new Date();
        await tokenDoc.save();

        // Audit log
        await AuditLog.log({
          userId: tokenDoc.userId,
          action: 'LOGOUT',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status: 'success'
        });
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Logout from all devices
 */
exports.logoutAll = async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany(
      { userId: req.user._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
