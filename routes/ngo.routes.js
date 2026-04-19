/**
 * NGO Routes
 */
const express = require('express');
const router = express.Router();
const { claimDonation, submitFeedback } = require('../controllers/ngo.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// All NGO routes require authentication + ngo role
router.use(authenticate);
router.use(authorize('ngo'));

// POST /api/ngo/claim/:donationId
router.post('/claim/:donationId', claimDonation);

// POST /api/ngo/feedback/:donationId
router.post('/feedback/:donationId', submitFeedback);

module.exports = router;
