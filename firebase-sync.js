/* ==========================================
   Firebase Real-Time Synchronization
   Sincroniza tareas, apuntes y agua en tiempo real
   ========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, setDoc, getDocs, doc, onSnapshot, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCZBa3Lk2MuSiH9MqbZ3EoB6LLJmBVxhnk",
  authDomain: "estudioflow-db.firebaseapp.com",
  projectId: "estudioflow-db",
  storageBucket: "estudioflow-db.firebasestorage.app",
  messagingSenderId: "135944532489",
  appId: "1:135944532489:web:9db3ba6e1488a9a040bed8",
  measurementId: "G-G2M0JM6TVQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Authenticate anonymously
let userUID = null;
signInAnonymously(auth)
  .then((result) => {
    userUID = result.user.uid;
    console.log('✅ Authenticated as:', userUID);
    
    // Initialize real-time listeners after auth
    setupRealtimeSync();
  })
  .catch((error) => {
    console.error('❌ Auth failed:', error);
  });

// Global reference to callback functions (set by app.js)
window.firebaseCallbacks = {
  onTasksUpdate: null,
  onNotesUpdate: null,
  onWaterUpdate: null
};

function setupRealtimeSync() {
  if (!userUID) return;
  
  // ==========================================
  // TASKS REAL-TIME LISTENER
  // ==========================================
  const tasksRef = collection(db, `users/${userUID}/tasks`);
  onSnapshot(tasksRef, (snapshot) => {
    const tasks = [];
    snapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by ID to maintain order
    tasks.sort((a, b) => a.id - b.id);
    
    // Call the callback from app.js
    if (window.firebaseCallbacks.onTasksUpdate) {
      window.firebaseCallbacks.onTasksUpdate(tasks);
    }
    console.log('📥 Tasks synced:', tasks);
  });
  
  // ==========================================
  // NOTEBOOKS REAL-TIME LISTENER
  // ==========================================
  const notebooksRef = collection(db, `users/${userUID}/notebooks`);
  onSnapshot(notebooksRef, (snapshot) => {
    const notebooks = [];
    snapshot.forEach((doc) => {
      notebooks.push({ id: doc.id, ...doc.data() });
    });
    
    // Call the callback from app.js
    if (window.firebaseCallbacks.onNotesUpdate) {
      window.firebaseCallbacks.onNotesUpdate(notebooks);
    }
    console.log('📥 Notebooks synced:', notebooks);
  });
  
  // ==========================================
  // WATER TRACKER REAL-TIME LISTENER
  // ==========================================
  const waterRef = doc(db, `users/${userUID}/data/water`);
  onSnapshot(waterRef, (doc) => {
    if (doc.exists()) {
      if (window.firebaseCallbacks.onWaterUpdate) {
        window.firebaseCallbacks.onWaterUpdate(doc.data());
      }
      console.log('💧 Water data synced:', doc.data());
    }
  });
}

// ==========================================
// EXPORT FUNCTIONS FOR app.js
// ==========================================

export async function saveTask(task) {
  if (!userUID) return;
  try {
    const taskRef = doc(db, `users/${userUID}/tasks/${task.id}`);
    await setDoc(taskRef, {
      ...task,
      timestamp: serverTimestamp()
    });
    console.log('✅ Task saved:', task.id);
  } catch (error) {
    console.error('❌ Error saving task:', error);
  }
}

export async function deleteTask(taskId) {
  if (!userUID) return;
  try {
    const taskRef = doc(db, `users/${userUID}/tasks/${taskId}`);
    await deleteDoc(taskRef);
    console.log('✅ Task deleted:', taskId);
  } catch (error) {
    console.error('❌ Error deleting task:', error);
  }
}

export async function saveNotebook(notebook) {
  if (!userUID) return;
  try {
    const nbRef = doc(db, `users/${userUID}/notebooks/${notebook.id}`);
    await setDoc(nbRef, {
      ...notebook,
      timestamp: serverTimestamp()
    });
    console.log('✅ Notebook saved:', notebook.id);
  } catch (error) {
    console.error('❌ Error saving notebook:', error);
  }
}

export async function deleteNotebook(notebookId) {
  if (!userUID) return;
  try {
    const nbRef = doc(db, `users/${userUID}/notebooks/${notebookId}`);
    await deleteDoc(nbRef);
    console.log('✅ Notebook deleted:', notebookId);
  } catch (error) {
    console.error('❌ Error deleting notebook:', error);
  }
}

export async function updateWaterData(waterData) {
  if (!userUID) return;
  try {
    const waterRef = doc(db, `users/${userUID}/data/water`);
    await setDoc(waterRef, {
      ...waterData,
      timestamp: serverTimestamp()
    });
    console.log('✅ Water data saved:', waterData);
  } catch (error) {
    console.error('❌ Error saving water data:', error);
  }
}

export function getUserUID() {
  return userUID;
}

export function getDB() {
  return db;
}
