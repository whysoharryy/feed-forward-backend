/**
 * Auth Controller
 * Handles user signup and profile retrieval
 */
const { db, auth } = require('../config/firebase');
const AppError = require('../utils/AppError');

/**
 * POST /api/auth/signup
 * Creates user in Firebase Auth + stores profile in Firestore
 * Body: { name, email, password, role }
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    // Validate role
    const validRoles = ['admin', 'donor', 'ngo', 'volunteer'];
    if (!validRoles.includes(role)) {
      throw new AppError('Invalid role. Must be: admin, donor, ngo, or volunteer', 400);
    }

    // The frontend has already created the user in Firebase Auth.
    // We just need to decode the token to get the UID and create the Firestore profile.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided. Please ensure you are authenticated.', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    // Ensure the token matches the requested email (for security against tampering)
    if (decodedToken.email !== email) {
      throw new AppError('Email in token does not match request email.', 403);
    }

    const uid = decodedToken.uid;

    // Build user profile for Firestore
    const userProfile = {
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    };

    // Store in Firestore using Firebase Auth UID as document ID
    await db.collection('users').doc(uid).set(userProfile);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        uid,
        ...userProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile
 * Requires: authenticate middleware
 */
const getMe = async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      throw new AppError('User profile not found', 404);
    }

    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        ...userDoc.data(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, getMe };
