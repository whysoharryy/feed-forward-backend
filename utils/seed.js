/**
 * Seed Script
 * Creates demo users in Firebase Auth + Firestore and initializes stats
 * Run: node utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { auth, db } = require('../config/firebase');

const DEMO_USERS = [
  {
    email: 'admin@feedforward.com',
    password: 'password',
    name: 'Admin One',
    role: 'admin',
  },
  {
    email: 'donor@feedforward.com',
    password: 'password',
    name: 'Fresh Foods Co',
    role: 'donor',
  },
  {
    email: 'ngo@feedforward.com',
    password: 'password',
    name: 'City Hope Shelter',
    role: 'ngo',
  },
  {
    email: 'volunteer@feedforward.com',
    password: 'password',
    name: 'John Doe',
    role: 'volunteer',
  },
];

const INITIAL_STATS = {
  totalFoodSaved: 0,
  mealsServed: 0,
  activeVolunteers: 0,
  co2Reduced: 0,
};

async function seed() {
  console.log('🌱 Starting seed process...\n');

  // Create demo users
  for (const user of DEMO_USERS) {
    try {
      // Check if user already exists in Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(user.email);
        console.log(`✓ User ${user.email} already exists (uid: ${userRecord.uid})`);
      } catch (e) {
        // User doesn't exist, create them
        userRecord = await auth.createUser({
          email: user.email,
          password: user.password,
          displayName: user.name,
        });
        console.log(`✓ Created Firebase Auth user: ${user.email} (uid: ${userRecord.uid})`);
      }

      // Create/update Firestore profile
      const profile = {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      };

      await db.collection('users').doc(userRecord.uid).set(profile, { merge: true });
      console.log(`  → Firestore profile saved for ${user.name} (${user.role})\n`);
    } catch (error) {
      console.error(`✗ Error creating user ${user.email}:`, error.message);
    }
  }

  // Initialize platform stats
  try {
    await db.collection('stats').doc('global').set(INITIAL_STATS, { merge: true });
    console.log('✓ Platform stats initialized');
    console.log(`  → Food saved: ${INITIAL_STATS.totalFoodSaved}kg`);
    console.log(`  → Meals served: ${INITIAL_STATS.mealsServed}`);
    console.log(`  → Active volunteers: ${INITIAL_STATS.activeVolunteers}`);
    console.log(`  → CO2 reduced: ${INITIAL_STATS.co2Reduced}kg`);
  } catch (error) {
    console.error('✗ Error initializing stats:', error.message);
  }

  console.log('\n🎉 Seed complete!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
