/**
 * Task Routes (Volunteer)
 */
const express = require('express');
const router = express.Router();
const {
  getTasks,
  acceptTask,
  generateOtp,
  confirmPickup,
  completeTask,
} = require('../controllers/task.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// All task routes require authentication + volunteer role
router.use(authenticate);
router.use(authorize('volunteer'));

// GET /api/tasks
router.get('/', getTasks);

// POST /api/tasks/accept/:taskId
router.post('/accept/:taskId', acceptTask);

// POST /api/tasks/generate-otp/:taskId
router.post('/generate-otp/:taskId', generateOtp);

// POST /api/tasks/pickup/:taskId (OTP verification)
router.post('/pickup/:taskId', confirmPickup);

// POST /api/tasks/complete/:taskId
router.post('/complete/:taskId', completeTask);

module.exports = router;
