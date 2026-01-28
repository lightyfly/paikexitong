import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

declare global {
  interface Window {
    __initial_auth_token?: string
  }
}

export type FirebaseHandles = {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

export function initFirebase(): FirebaseHandles {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  if (!firebaseConfig.projectId || !firebaseConfig.apiKey || !firebaseConfig.appId) {
    throw new Error('Missing Firebase env vars (need VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY / VITE_FIREBASE_APP_ID)')
  }

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  return { app, auth, db }
}

export async function ensureSignedIn(auth: Auth) {
  const token = window.__initial_auth_token
  if (token) {
    await signInWithCustomToken(auth, token)
  } else {
    await signInAnonymously(auth)
  }
}

export function waitForUser(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user)
    })
  })
}

export function getAppId() {
  return String(import.meta.env.VITE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || 'default')
}
