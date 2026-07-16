import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "pretso-database",
  appId: "1:48942361199:web:4295a16d5dbe400b653b9a",
  storageBucket: "pretso-database.firebasestorage.app",
  apiKey: "AIzaSyCxEhBnq_4vA3DzVwxy6MdC89l94yncfNM",
  authDomain: "pretso-database.firebaseapp.com",
  messagingSenderId: "48942361199"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
