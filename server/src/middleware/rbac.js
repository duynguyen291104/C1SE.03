/**
 * Middleware to check if user has required role(s)
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRoles
      });
    }

    next();
  };
};

/**
 * Middleware to check if teacher is approved
 */
const requireApprovedTeacher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.isApprovedTeacher()) {
    return res.status(403).json({ 
      error: 'Teacher approval required',
      teacherStatus: req.user.teacherStatus
    });
  }

  next();
};

module.exports = {
  requireRole,
  requireApprovedTeacher
};
