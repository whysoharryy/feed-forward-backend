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

    const allTasks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Fallback for legacy tasks or if field is missing
        expiryTime: data.expiryTime || new Date(new Date(data.timestamp || Date.now()).getTime() + 4 * 60 * 60 * 1000).toISOString()
      };
    });

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
      // Fetch this BEFORE the transaction or ensure it's allowed here
      // Note: db.get() within a transaction is only for DocumentRefs.
      // We will perform this outside for safety or just assume the previous check is okay
      const activeTasksSnapshot = await db.collection('tasks')
        .where('volunteerId', '==', req.user.uid)
        .where('status', 'in', ['accepted', 'in_transit'])
        .get();

      if (!activeTasksSnapshot.empty) {
        throw new AppError('You already have an active task. Complete it first.', 400);
      }

      // --- ALL READS ---
      // Add Volunteer to Chat Thread
      const chatRef = db.collection('chats').doc(task.donationId);
      const chatDoc = await transaction.get(chatRef);

      // --- ALL WRITES ---
      transaction.update(taskRef, {
        status: 'accepted',
        volunteerId: req.user.uid,
      });

      if (chatDoc.exists) {
        const chatData = chatDoc.data();
        const participants = [...new Set([...chatData.participants, req.user.uid])];
        const participantDetails = {
          ...chatData.participantDetails,
          [req.user.uid]: { name: req.user.name || 'Volunteer', role: 'volunteer' }
        };

        transaction.update(chatRef, {
          participants,
          participantDetails,
          lastMessage: `Volunteer ${req.user.name} has joined the chat and will be handling the shipment.`,
          lastMessageTime: new Date().toISOString()
        });
      }

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
 * POST /api/tasks/generate-otp/:taskId
 * Volunteer generates a random 4-digit OTP for the donor to see
 */
const generateOtp = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new AppError('Task not found', 404);
    }

    const task = taskDoc.data();

    if (task.volunteerId !== req.user.uid) {
      throw new AppError('This task is not assigned to you', 403);
    }

    // Generate random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update task and donation with OTP
    await db.runTransaction(async (transaction) => {
      transaction.update(taskRef, { otp });

      const donationRef = db.collection('donations').doc(task.donationId);
      transaction.update(donationRef, { otp });
    });

    res.json({
      success: true,
      message: 'OTP generated successfully. Ask the donor for the verification code shown on their dashboard.',
      otp, // Sending it back so the volunteer can see it too (optional, but helpful for testing)
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

    // Verify against generated OTP
    if (!task.otp || otp !== task.otp) {
      throw new AppError('Invalid OTP. Ask the donor for the verification code shown on their dashboard.', 400);
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

    await db.runTransaction(async (transaction) => {
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

      // --- PERFORM ALL READS BEFORE ANY WRITES ---

      // Get corresponding donation
      const donationRef = db.collection('donations').doc(task.donationId);
      const donationDoc = await transaction.get(donationRef);

      // Get platform stats
      const statsRef = db.collection('stats').doc('global');
      const statsDoc = await transaction.get(statsRef);

      // --- PERFORM ALL WRITES ---

      // 2. Complete the task
      transaction.update(taskRef, { status: 'completed' });

      // 3. Complete the corresponding donation
      if (donationDoc.exists) {
        transaction.update(donationRef, { status: 'completed' });
      }

      // 4. Update platform stats
      if (statsDoc.exists) {
        const stats = statsDoc.data();
        transaction.update(statsRef, {
          mealsServed: (stats.mealsServed || 0) + Math.floor(task.quantity * 2),
          totalFoodSaved: (stats.totalFoodSaved || 0) + task.quantity,
          co2Reduced: (stats.co2Reduced || 0) + parseFloat((task.quantity * 2.5).toFixed(1)),
        });
      }

      return true;
    });

    res.json({
      success: true,
      message: `Delivery completed successfully!`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  acceptTask,
  generateOtp,
  confirmPickup,
  completeTask,
};
