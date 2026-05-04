const firebaseConfig = {
  apiKey: "AIzaSyDrw9EvvSpoExabN9E1TgkILhnJEelZ9zs",
  authDomain: "kpi-pulse-4ab5b.firebaseapp.com",
  projectId: "kpi-pulse-4ab5b",
  storageBucket: "kpi-pulse-4ab5b.firebasestorage.app",
  messagingSenderId: "164236812174",
  appId: "1:164236812174:web:5db5f25955ec0771fa8edf",
  measurementId: "G-2E9NSHE0PR"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();