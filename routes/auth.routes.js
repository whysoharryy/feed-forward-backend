/**
 * Auth Routes
 */
const express = require('express');
const router = express.Router();
const { signup, getMe } = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const Joi = require('joi');

// Validation schemas
const signupSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'donor', 'ngo', 'volunteer').required(),
});

// POST /api/auth/signup
router.post('/signup', validate(signupSchema), signup);

// GET /api/auth/me (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
