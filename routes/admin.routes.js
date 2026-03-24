/**
 * Admin Routes
 */
const express = require('express');
const router = express.Router();
const {
  getPendingDonations,
  verifyDonation,
  getAllUsers,
  getStats,
} = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/pending
router.get('/pending', getPendingDonations);

// PUT /api/admin/verify/:id
router.put('/verify/:id', verifyDonation);

// GET /api/admin/users
router.get('/users', getAllUsers);

// GET /api/admin/stats
router.get('/stats', getStats);

module.exports = router;
