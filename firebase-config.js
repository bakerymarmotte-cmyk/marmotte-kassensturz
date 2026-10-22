// Firebase-Konfiguration für Marmotte Kassensturz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAJg8SJ8VFUI5_icaJ2Wqa4BC420nYDhl8",
  authDomain: "marmotte-kassensturz.firebaseapp.com",
  projectId: "marmotte-kassensturz",
  storageBucket: "marmotte-kassensturz.firebasestorage.app",
  messagingSenderId: "351268635421",
  appId: "1:351268635421:web:6e61f976c0ecbcdda197f4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
