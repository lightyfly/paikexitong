import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { AppState } from './types'
import { withBackoffRetry } from './retry'

const STATE_DOC_ID = 'config'

export function getStateDocRef(db: Firestore, appId: string) {
  // 6 segments doc path: /artifacts/{appId}/public/data/app_state/config
  return doc(db, 'artifacts', appId, 'public', 'data', 'app_state', STATE_DOC_ID)
}

export async function loadAppState(db: Firestore, appId: string): Promise<Partial<AppState> | null> {
  const ref = getStateDocRef(db, appId)
  const snap = await withBackoffRetry(() => getDoc(ref), { shouldRetry: () => true })
  if (!snap.exists()) return null
  return (snap.data() as any) ?? null
}

export async function saveAppState(db: Firestore, appId: string, state: Omit<AppState, 'hasLoaded'>) {
  const ref = getStateDocRef(db, appId)
  await withBackoffRetry(
    () =>
      setDoc(
        ref,
        {
          ...state,
          updatedAt: Date.now(),
        } as any,
        { merge: false },
      ),
    { shouldRetry: () => true },
  )
}
