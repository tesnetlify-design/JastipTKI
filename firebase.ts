
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB9o8oym5q-T7vZ8g9UwuzorwRWRx3o0q0",
    authDomain: "jastiptki.firebaseapp.com",
    projectId: "jastiptki",
    storageBucket: "jastiptki.firebasestorage.app",
    messagingSenderId: "995597617074",
    appId: "1:995597617074:web:923f0e8ce91833cd2b46ab",
    measurementId: "G-ZXTK5G1T03"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
