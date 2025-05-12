
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXfN1ncMTR0ytj8EEA6lB_sFfBkvWYgO0",
  authDomain: "db8app.firebaseapp.com",
  projectId: "db8app",
  storageBucket: "db8app.firebasestorage.app",
  messagingSenderId: "119149680869",
  appId: "1:119149680869:web:27e943e5382f8ebf889c0c"
};

// Initialize Firebase, ensuring it's only initialized once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
