import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// These values are copied directly from your Firebase screenshot
const firebaseConfig = {
  apiKey: "AIzaSyCSN9GF9782RhPVVqe5YMEogbNK_uX3Pmw",
  authDomain: "stemm-lab-app-6ec5b.firebaseapp.com",
  projectId: "stemm-lab-app-6ec5b",
  storageBucket: "stemm-lab-app-6ec5b.firebasestorage.app",
  messagingSenderId: "291260475339",
  appId: "1:291260475339:web:be86f29022df71276ef84e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to use in your other tasks
export const db = getFirestore(app); // Needed for SCRUM-92 (Data Sync)
export const auth = getAuth(app);    // Needed for SCRUM-91 (Authentication)