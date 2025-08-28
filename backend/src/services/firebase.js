import admin from 'firebase-admin';

let adminApp;

export const initializeFirebase = async () => {
  try {
    if (!admin.apps.length) {
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        storageBucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET
      });
    } else {
      adminApp = admin.app();
    }

    console.log('✅ Firebase Admin initialized');
    return adminApp;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

export { admin };
export const db = admin.firestore();
export const storage = admin.storage();
