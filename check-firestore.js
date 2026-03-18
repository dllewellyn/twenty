const admin = require('firebase-admin');

async function main() {
  admin.initializeApp({ projectId: 'test' });
  const db = admin.firestore();
  db.settings({
    host: '127.0.0.1:8080',
    ssl: false,
  });
  console.log('Attempting to fetch docs...');
  try {
    const snapshot = await db.collection('test').get();
    console.log('Success! Count:', snapshot.size);
  } catch (e) {
    console.error('Failed:', e);
  }
}

main();
