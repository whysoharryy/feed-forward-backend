/**
 * Donation Routes
 */
const express = require('express');
const router = express.Router();
const {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  deleteDonation,
} = require('../controllers/donation.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Joi = require('joi');

// Validation schema for creating a donation
const createDonationSchema = Joi.object({
  foodType: Joi.string().required(),
  quantity: Joi.number().min(0.5).required(),
  description: Joi.string().allow('').optional(),
  expiryHours: Joi.number().min(1).max(168).optional(), // Max 1 week
  imageUrl: Joi.string().allow('').optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
});

// All routes require authentication
router.use(authenticate);

// POST /api/donations (donor only)
router.post('/', authorize('donor'), validate(createDonationSchema), createDonation);

// GET /api/donations (all authenticated users, filtered by role)
router.get('/', getDonations);

// GET /api/donations/:id
router.get('/:id', getDonationById);

// PUT /api/donations/:id (donor or admin)
router.put('/:id', authorize('donor', 'admin'), updateDonation);

// DELETE /api/donations/:id (donor or admin)
router.delete('/:id', authorize('donor', 'admin'), deleteDonation);

module.exports = router;
