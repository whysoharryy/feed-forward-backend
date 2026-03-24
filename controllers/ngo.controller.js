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
        donorName: donation.donorName,
        ngoName: req.user.name,
        ngoId: req.user.uid,
        volunteerId: null,
        status: 'open',
        timestamp: new Date().toISOString(),
      };
      transaction.set(taskRef, newTask);

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

module.exports = { claimDonation };
