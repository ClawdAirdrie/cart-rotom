// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#available-libraries
const firebaseConfig = {
    apiKey: "AIzaSyB2zjURAe_698LIq7dmnf6DZS4wiJ_hv3I",
    authDomain: "cart-rotom.firebaseapp.com",
    projectId: "cart-rotom",
    storageBucket: "cart-rotom.firebasestorage.app",
    messagingSenderId: "823921881117",
    appId: "1:823921881117:web:da7656cef6fe6ec65d56f4",
    measurementId: "G-Q5PS22K8B8"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
