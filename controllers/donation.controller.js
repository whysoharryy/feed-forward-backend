/**
 * Donation Controller
 * CRUD operations for food donations
 */
const { db } = require('../config/firebase');
const AppError = require('../utils/AppError');

/**
 * POST /api/donations
 * Donor creates a new donation listing
 */
const createDonation = async (req, res, next) => {
  try {
    const { foodType, quantity, description, expiryHours, imageUrl, lat, lng } = req.body;

    const donation = {
      donorId: req.user.uid,
      donorName: req.user.name,
      foodType,
      quantity: parseFloat(quantity),
      description: description || '',
      imageUrl: imageUrl || '',
      status: 'pending_verification',
      ngoId: null,
      timestamp: new Date().toISOString(),
      expiryTime: new Date(Date.now() + 1000 * 60 * 60 * (parseInt(expiryHours) || 4)).toISOString(),
      lat: lat || 0,
      lng: lng || 0,
    };

    const docRef = await db.collection('donations').add(donation);

    res.status(201).json({
      success: true,
      message: 'Donation submitted for verification!',
      donation: { id: docRef.id, ...donation },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/donations
 * Returns donations filtered by role:
 * - donor: only own donations
 * - ngo: only verified donations (available for claim)
 * - admin: all donations
 * - volunteer: all claimed/completed donations
 */
const getDonations = async (req, res, next) => {
  try {
    let query = db.collection('donations');

    switch (req.user.role) {
      case 'donor':
        query = query.where('donorId', '==', req.user.uid);
        break;
      case 'ngo':
        // NGOs see verified donations + their own claimed ones
        // We'll fetch all and filter in memory for simplicity
        break;
      case 'admin':
        // Admin sees all
        break;
      case 'volunteer':
        // Volunteers see claimed/completed
        break;
    }

    const snapshot = await query.get();

    let donations = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        expiryTime: data.expiryTime || new Date(new Date(data.timestamp || Date.now()).getTime() + 4 * 60 * 60 * 1000).toISOString()
      };
    });

    // Sort by timestamp descending in memory to avoid Firebase composite index errors
    donations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Additional role-based filtering
    if (req.user.role === 'ngo') {
      donations = donations.filter(
        d => d.status === 'verified' || d.ngoId === req.user.uid
      );
    }

    res.json({
      success: true,
      donations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/donations/:id
 * Returns a single donation by ID
 */
const getDonationById = async (req, res, next) => {
  try {
    const doc = await db.collection('donations').doc(req.params.id).get();

    if (!doc.exists) {
      throw new AppError('Donation not found', 404);
    }

    res.json({
      success: true,
      donation: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/donations/:id
 * Updates a donation (only by the donor who created it)
 */
const updateDonation = async (req, res, next) => {
  try {
    const docRef = db.collection('donations').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new AppError('Donation not found', 404);
    }

    const donation = doc.data();

    // Only the donor who created it or admin can update
    if (donation.donorId !== req.user.uid && req.user.role !== 'admin') {
      throw new AppError('Not authorized to update this donation', 403);
    }

    // Only allow updates if still pending
    if (donation.status !== 'pending_verification' && req.user.role !== 'admin') {
      throw new AppError('Cannot update a donation that has already been verified', 400);
    }

    const allowedFields = ['foodType', 'quantity', 'description', 'expiryHours', 'imageUrl'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'expiryHours') {
          updates['expiryTime'] = new Date(Date.now() + 1000 * 60 * 60 * parseInt(req.body[field])).toISOString();
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    await docRef.update(updates);

    res.json({
      success: true,
      message: 'Donation updated successfully',
      donation: { id: doc.id, ...donation, ...updates },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/donations/:id
 * Deletes a donation (only by donor or admin)
 */
const deleteDonation = async (req, res, next) => {
  try {
    const docRef = db.collection('donations').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new AppError('Donation not found', 404);
    }

    const donation = doc.data();

    if (donation.donorId !== req.user.uid && req.user.role !== 'admin') {
      throw new AppError('Not authorized to delete this donation', 403);
    }

    if (donation.status === 'claimed' || donation.status === 'completed') {
      throw new AppError('Cannot delete a donation that has been claimed or completed', 400);
    }

    await docRef.delete();

    res.json({
      success: true,
      message: 'Donation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  deleteDonation,
};
