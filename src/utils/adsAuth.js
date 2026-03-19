const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const authHeader = req.headers['authorization'];
  
  if (adminKey && adminKey === process.env.ADS_ADMIN_KEY) {
    return next();
  }
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: 'Unauthorized - Admin API key or JWT token required'
  });
};

module.exports = { adminAuth };
