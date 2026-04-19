const { db } = require('./config/firebase');

async function deleteCollection(collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next batch
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function wipe() {
    console.log('--- Wiping Transactional Data ---');
    try {
        console.log('Deleting "donations"...');
        await deleteCollection('donations', 20);
        console.log('Deleting "chats"...');
        await deleteCollection('chats', 20);
        console.log('Deleting "notifications"...');
        await deleteCollection('notifications', 20);
        console.log('Deleting "tasks"...');
        await deleteCollection('tasks', 20);
        console.log('Deleting "users"...');
        await deleteCollection('users', 20);
        console.log('Deleting "stats"...');
        await deleteCollection('stats', 20);
        console.log('\n--- SUCCESS: All listings and chats refreshed! ---\n');
        process.exit(0);
    } catch (err) {
        console.error('Wipe failed:', err);
        process.exit(1);
    }
}

wipe();
