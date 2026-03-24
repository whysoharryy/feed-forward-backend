/**
 * Leaderboard Routes (Public - any authenticated user)
 */
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authenticate = require('../middleware/authenticate');

// All routes require authentication but any role can access
router.use(authenticate);

/**
 * GET /api/leaderboard
 * Returns volunteer and partner leaderboards
 */
router.get('/', async (req, res, next) => {
  try {
    const snapshot = await db.collection('users').get();
    const allUsers = snapshot.docs.map(doc => ({
      uid: doc.id,
      name: doc.data().name,
      role: doc.data().role,
      karma: doc.data().karma,
      trustRating: doc.data().trustRating,
    }));

    const volunteers = allUsers
      .filter(u => u.role === 'volunteer')
      .sort((a, b) => (b.karma || 0) - (a.karma || 0))
      .slice(0, 10);

    const partners = allUsers
      .filter(u => u.role === 'donor' || u.role === 'ngo')
      .sort((a, b) => (b.trustRating || 0) - (a.trustRating || 0))
      .slice(0, 10);

    res.json({
      success: true,
      volunteers,
      partners,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
