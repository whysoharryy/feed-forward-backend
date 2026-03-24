/**
 * Firebase Admin SDK Configuration
 * Initializes Firestore and Auth services for backend use
 */
const admin = require('firebase-admin');
const path = require('path');

// Load service account key
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
