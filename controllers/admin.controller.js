/**
 * Admin Controller
 * Handles donation verification, user management, and platform stats
 */
const { db } = require('../config/firebase');
const AppError = require('../utils/AppError');

/**
 * GET /api/admin/pending
 * Returns all donations pending verification
 */
const getPendingDonations = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection('donations')
      .where('status', '==', 'pending_verification')
      .orderBy('timestamp', 'desc')
      .get();

    const donations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      donations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/verify/:id
 * Approve or reject a donation
 * Body: { approved: true/false }
 */
const verifyDonation = async (req, res, next) => {
  try {
    const { approved } = req.body;

    if (typeof approved !== 'boolean') {
      throw new AppError('Field "approved" must be a boolean', 400);
    }

    const docRef = db.collection('donations').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new AppError('Donation not found', 404);
    }

    const donation = doc.data();

    if (donation.status !== 'pending_verification') {
      throw new AppError('This donation is not pending verification', 400);
    }

    const newStatus = approved ? 'verified' : 'rejected';
    await docRef.update({ status: newStatus });

    res.json({
      success: true,
      message: `Donation ${approved ? 'approved' : 'rejected'} successfully`,
      donation: { id: doc.id, ...donation, status: newStatus },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users
 * Returns all users (admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/stats
 * Returns platform statistics
 */
const getStats = async (req, res, next) => {
  try {
    const statsDoc = await db.collection('stats').doc('global').get();

    if (!statsDoc.exists) {
      // Return default stats if not initialized
      return res.json({
        success: true,
        stats: {
          totalFoodSaved: 0,
          mealsServed: 0,
          activeVolunteers: 0,
          co2Reduced: 0,
        },
      });
    }

    res.json({
      success: true,
      stats: statsDoc.data(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingDonations,
  verifyDonation,
  getAllUsers,
  getStats,
};
