/**
 * Firebase Admin SDK Configuration
 * Initializes Firestore and Auth services for backend use
 */
const admin = require('firebase-admin');
const path = require('path');

// Construct service account object from environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

// Initialize Firebase Admin
if (serviceAccount.private_key) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  console.error("Firebase Admin could not be initialized: FIREBASE_PRIVATE_KEY is missing.");
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
