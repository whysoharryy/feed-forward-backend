/**
 * NGO Controller
 * Handles donation claiming by NGOs
 */
const { db } = require('../config/firebase');
const AppError = require('../utils/AppError');

/**
 * POST /api/ngo/claim/:donationId
 * NGO claims a verified donation
 * Auto-creates a volunteer task
 */
const claimDonation = async (req, res, next) => {
  try {
    const { donationId } = req.params;

    // Use a Firestore transaction for atomicity
    const result = await db.runTransaction(async (transaction) => {
      const donationRef = db.collection('donations').doc(donationId);
      const donationDoc = await transaction.get(donationRef);

      if (!donationDoc.exists) {
        throw new AppError('Donation not found', 404);
      }

      const donation = donationDoc.data();

      // Only verified donations can be claimed
      if (donation.status !== 'verified') {
        throw new AppError('This donation is not available for claiming. Current status: ' + donation.status, 400);
      }

      // Update donation status to claimed
      transaction.update(donationRef, {
        status: 'claimed',
        ngoId: req.user.uid,
      });

      // Auto-create volunteer task
      const taskRef = db.collection('tasks').doc(); // auto-generate ID
      const newTask = {
        donationId: donationId,
        foodType: donation.foodType,
        quantity: donation.quantity,
        donorId: donation.donorId,
        donorName: donation.donorName,
        ngoName: req.user.name,
        ngoId: req.user.uid,
        volunteerId: null,
        status: 'open',
        timestamp: new Date().toISOString(),
        expiryTime: donation.expiryTime,
      };
      transaction.set(taskRef, newTask);

      // Initialize Chat Thread between Donor and NGO
      const chatRef = db.collection('chats').doc(donationId); // Use donationId as chat session ID
      const chatData = {
        donationId: donationId,
        foodType: donation.foodType,
        participants: [donation.donorId, req.user.uid],
        participantDetails: {
          [donation.donorId]: { name: donation.donorName || 'Donor', role: 'donor' },
          [req.user.uid]: { name: req.user.name || 'NGO', role: 'ngo' }
        },
        lastMessage: 'Donation Claimed! Coordinate the logistics here.',
        lastMessageTime: new Date().toISOString(),
        unreadCount: { [donation.donorId]: 1, [req.user.uid]: 0 },
        typing: {}
      };
      transaction.set(chatRef, chatData, { merge: true });

      return {
        donation: { id: donationId, ...donation, status: 'claimed', ngoId: req.user.uid },
        task: { id: taskRef.id, ...newTask },
      };
    });

    res.json({
      success: true,
      message: 'Food claimed! A volunteer will be dispatched soon.',
      donation: result.donation,
      task: result.task,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ngo/feedback/:donationId
 * Body: { rating: Number, comment: String }
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { donationId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5 stars', 400);
    }

    // 1. Fetch Related Task to find Volunteer (Before Transaction)
    const taskQuery = await db.collection('tasks').where('donationId', '==', donationId).limit(1).get();
    let volunteerId = null;
    if (!taskQuery.empty) {
      volunteerId = taskQuery.docs[0].data().volunteerId;
    }

    const feedbackData = await db.runTransaction(async (transaction) => {
      const donationRef = db.collection('donations').doc(donationId);
      const donationDoc = await transaction.get(donationRef);

      if (!donationDoc.exists) throw new AppError('Donation not found', 404);

      const donation = donationDoc.data();

      if (donation.ngoId !== req.user.uid) {
        throw new AppError('Only the claiming NGO can submit feedback', 403);
      }
      if (donation.status !== 'completed') {
        throw new AppError('Feedback is only allowed for completed deliveries', 400);
      }
      if (donation.feedback) {
        throw new AppError('Feedback was already submitted', 400);
      }

      const feedback = {
        rating,
        comment: comment || '',
        timestamp: new Date().toISOString()
      };

      // Fetch Volunteer Doc if exists
      let volunteerRef = null;
      let volunteerDoc = null;
      if (volunteerId) {
        volunteerRef = db.collection('users').doc(volunteerId);
        volunteerDoc = await transaction.get(volunteerRef);
      }

      // Impact Donor Trust Rating - DEPRECATED
      
      // Perform all updates (WRITES)
      transaction.update(donationRef, { feedback });



      return feedback;
    });

    res.json({ success: true, message: 'Feedback submitted successfully', feedback: feedbackData });
  } catch (error) {
    next(error);
  }
};

module.exports = { claimDonation, submitFeedback };
