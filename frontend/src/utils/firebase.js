import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth, browserSessionPersistence, setPersistence, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyB3kULc02i-uhTvdTEBt5aZIA6SCJq8lK0',
  authDomain: 'chess-dd249.firebaseapp.com',
  projectId: 'chess-dd249',
  storageBucket: 'chess-dd249.firebasestorage.app',
  messagingSenderId: '644391617236',
  appId: '1:644391617236:web:592ab0870fa0a0e2393141',
  measurementId: 'G-0RW9MZY3QL'
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

setPersistence(firebaseAuth, browserSessionPersistence).catch(() => {
  // Keep app usable if persistence setup fails.
})

isSupported()
  .then((ok) => {
    if (ok) {
      getAnalytics(firebaseApp)
    }
  })
  .catch(() => {
    // Ignore analytics errors in unsupported environments.
  })
