
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";



const firebaseConfig = {
  apiKey: "AIzaSyDWb_H1rebH58itu63JBZf0QuPxOUaBleA",
  authDomain: "bookflix-3bab2.firebaseapp.com",
  projectId: "bookflix-3bab2",
  storageBucket: "bookflix-3bab2.firebasestorage.app",
  messagingSenderId: "169368305858",
  appId: "1:169368305858:web:c7f1274458f8802151bb5b",
  measurementId: "G-4QX3CV3519"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);
export const storage = getStorage(app);

