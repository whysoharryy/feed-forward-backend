/**
 * Task Controller
 * Handles volunteer task operations: listing, accepting, completing
 */
const { db } = require('../config/firebase');
const AppError = require('../utils/AppError');
const admin = require('firebase-admin');

/**
 * GET /api/tasks
 * Returns tasks based on context:
 * - Open tasks available for any volunteer
 * - Tasks assigned to the current volunteer
 */
const getTasks = async (req, res, next) => {
  try {
    const snapshot = await db.collection('tasks').orderBy('timestamp', 'desc').get();

    const allTasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Split into available (open) and assigned to current volunteer
    const availableTasks = allTasks.filter(t => t.status === 'open');
    const myActiveTasks = allTasks.filter(
      t => t.volunteerId === req.user.uid && (t.status === 'accepted' || t.status === 'in_transit')
    );
    const myCompletedTasks = allTasks.filter(
      t => t.volunteerId === req.user.uid && t.status === 'completed'
    );

    res.json({
      success: true,
      availableTasks,
      myActiveTasks,
      myCompletedTasks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks/accept/:taskId
 * Volunteer accepts an open task
 */
const acceptTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const result = await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new AppError('Task not found', 404);
      }

      const task = taskDoc.data();

      if (task.status !== 'open') {
        throw new AppError('This task is no longer available', 400);
      }

      // Check if volunteer already has an active task
      const activeTasksSnapshot = await db.collection('tasks')
        .where('volunteerId', '==', req.user.uid)
        .where('status', 'in', ['accepted', 'in_transit'])
        .get();

      if (!activeTasksSnapshot.empty) {
        throw new AppError('You already have an active task. Complete it first.', 400);
      }

      transaction.update(taskRef, {
        status: 'accepted',
        volunteerId: req.user.uid,
      });

      return { id: taskId, ...task, status: 'accepted', volunteerId: req.user.uid };
    });

    res.json({
      success: true,
      message: 'Task accepted! Proceed to pickup location.',
      task: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks/pickup/:taskId
 * Volunteer confirms pickup (OTP verification)
 * Body: { otp: "1234" }
 */
const confirmPickup = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { otp } = req.body;

    // Simple OTP verification (in production, generate real OTPs)
    if (otp !== '1234') {
      throw new AppError('Invalid OTP. Ask the donor for the verification code.', 400);
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new AppError('Task not found', 404);
    }

    const task = taskDoc.data();

    if (task.volunteerId !== req.user.uid) {
      throw new AppError('This task is not assigned to you', 403);
    }

    if (task.status !== 'accepted') {
      throw new AppError('Task must be in "accepted" status for pickup', 400);
    }

    await taskRef.update({ status: 'in_transit' });

    res.json({
      success: true,
      message: 'Pickup verified. Deliver to NGO.',
      task: { id: taskId, ...task, status: 'in_transit' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks/complete/:taskId
 * Volunteer completes delivery
 * Awards karma points and updates platform stats
 */
const completeTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const KARMA_REWARD = 150;

    const result = await db.runTransaction(async (transaction) => {
      // 1. Get and validate the task
      const taskRef = db.collection('tasks').doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new AppError('Task not found', 404);
      }

      const task = taskDoc.data();

      if (task.volunteerId !== req.user.uid) {
        throw new AppError('This task is not assigned to you', 403);
      }

      if (task.status !== 'in_transit') {
        throw new AppError('Task must be in transit to complete', 400);
      }

      // 2. Complete the task
      transaction.update(taskRef, { status: 'completed' });

      // 3. Complete the corresponding donation
      const donationRef = db.collection('donations').doc(task.donationId);
      const donationDoc = await transaction.get(donationRef);
      if (donationDoc.exists) {
        transaction.update(donationRef, { status: 'completed' });
      }

      // 4. Award karma to volunteer
      const userRef = db.collection('users').doc(req.user.uid);
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const currentKarma = userDoc.data().karma || 0;
        transaction.update(userRef, { karma: currentKarma + KARMA_REWARD });
      }

      // 5. Update platform stats
      const statsRef = db.collection('stats').doc('global');
      const statsDoc = await transaction.get(statsRef);
      if (statsDoc.exists) {
        const stats = statsDoc.data();
        transaction.update(statsRef, {
          mealsServed: (stats.mealsServed || 0) + Math.floor(task.quantity * 2),
          totalFoodSaved: (stats.totalFoodSaved || 0) + task.quantity,
          co2Reduced: (stats.co2Reduced || 0) + parseFloat((task.quantity * 2.5).toFixed(1)),
        });
      }

      return {
        karmaEarned: KARMA_REWARD,
        newKarma: (userDoc.exists ? userDoc.data().karma || 0 : 0) + KARMA_REWARD,
      };
    });

    res.json({
      success: true,
      message: `Delivery completed! You earned ${KARMA_REWARD} Karma Points.`,
      karmaEarned: result.karmaEarned,
      totalKarma: result.newKarma,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  acceptTask,
  confirmPickup,
  completeTask,
};
