import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, runTransaction,
  query, orderBy, serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBJvHDZgSG7csTHrlMWDNhq_FJ6fpCnSAc",
  authDomain: "dimsumkami-a6f9f.firebaseapp.com",
  projectId: "dimsumkami-a6f9f",
  storageBucket: "dimsumkami-a6f9f.firebasestorage.app",
  messagingSenderId: "569403895242",
  appId: "1:569403895242:web:1c883f4866a26204823333"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, onSnapshot, setDoc, runTransaction,
  query, orderBy, serverTimestamp
};