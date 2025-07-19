const jwt = require('jsonwebtoken');

module.exports = (requiredRole) => (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded); // { id, role }
    req.user = decoded;

    // If a role is required, check it (case-insensitive for consistency)
    if (requiredRole && req.user.role?.toLowerCase() !== requiredRole.toLowerCase()) {
      return res.status(403).json({ error: `Requires ${requiredRole} role` });
    }
    next();
  } catch (error) {
    console.error('Token verification error:', error.message, { stack: error.stack });
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};