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

// Require authentication for all
router.use(authenticate);

// Publicly available platform stats (for all authenticated roles)
router.get('/stats', getStats);

// Routes requiring admin authorization
router.use(authorize('admin'));

// GET /api/admin/pending
router.get('/pending', getPendingDonations);

// PUT /api/admin/verify/:id
router.put('/verify/:id', verifyDonation);

// GET /api/admin/users
router.get('/users', getAllUsers);

module.exports = router;
