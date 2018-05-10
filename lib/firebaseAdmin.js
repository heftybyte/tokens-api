const admin = require('firebase-admin');
const serviceAccount = require('../data/serviceAccountKey.json');

admin.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectID: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export default admin