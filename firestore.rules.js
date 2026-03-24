// Firestore Security Rules for GreenBite
// 
// Since ALL data access goes through the Express backend 
// (which uses Firebase Admin SDK - bypasses these rules),
// we DENY all direct client-side access to Firestore.
//
// Deploy these rules in Firebase Console → Firestore → Rules
//
// rules_version = '2';
//
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Deny all direct client reads/writes
//     // All access goes through the Express backend using Admin SDK
//     match /{document=**} {
//       allow read, write: if false;
//     }
//   }
// }
