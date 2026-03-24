/**
 * Authentication Middleware
 * Verifies Firebase ID tokens from the Authorization header
 * Attaches user info (uid, email, role) to req.user
 */
const { auth, db } = require('../config/firebase');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);

    // Fetch user profile from Firestore for role info
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found. Please sign up first.',
      });
    }

    const userData = userDoc.data();

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
      name: userData.name,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

module.exports = authenticate;
