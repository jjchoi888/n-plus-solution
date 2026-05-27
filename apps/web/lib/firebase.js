import { initializeApp } from 'firebase/app';

// Fallback public config for environments where NEXT_PUBLIC_* vars were not injected at build time.
// These are public Firebase client keys (not server secrets).
const fallbackFirebaseConfig = {
    apiKey: 'AIzaSyAaO32y6cwOQiQWWrjCnIe-3qMnybX5Nik',
    authDomain: 'hotel-pms-5cf9e.firebaseapp.com',
    projectId: 'hotel-pms-5cf9e',
    storageBucket: 'hotel-pms-5cf9e.firebasestorage.app',
    messagingSenderId: '919351571745',
    appId: '1:919351571745:web:a6bf201771e9d68dfffa60'
};

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || fallbackFirebaseConfig.appId
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
