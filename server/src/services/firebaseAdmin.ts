import admin from 'firebase-admin';

let initialized = false;

function getFirebaseAdmin() {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      // Fallback: initialize without credentials (won't work for token verification)
      admin.initializeApp();
    }
    initialized = true;
  }
  return admin;
}

export async function verifyFirebaseToken(idToken: string) {
  const firebaseAdmin = getFirebaseAdmin();
  const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
  return decodedToken;
}
