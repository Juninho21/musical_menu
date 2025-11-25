import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyAS2RR7kBJu8PUu4VpTKd1QRcKi2MdRhYA",
    authDomain: "musical-menu-app-2025.firebaseapp.com",
    projectId: "musical-menu-app-2025",
    storageBucket: "musical-menu-app-2025.firebasestorage.app",
    messagingSenderId: "42023414770",
    appId: "1:42023414770:web:5d5ce002ccc28b08df996b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with experimentalForceLongPolling to try and bypass browser blocks
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

const auth = getAuth(app);

export { app, db, auth };
