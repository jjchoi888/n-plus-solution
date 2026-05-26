import { initializeApp } from 'firebase/app';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasValidFirebaseConfig = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export let app = null;
export let firebaseInitError = null;

try {
    if (hasValidFirebaseConfig) {
        app = initializeApp(firebaseConfig);
    } else {
        firebaseInitError = 'Firebase config is missing. Check NEXT_PUBLIC_FIREBASE_* env values.';
    }
} catch (error) {
    firebaseInitError = error?.message || 'Failed to initialize Firebase.';
}

export { hasValidFirebaseConfig };
