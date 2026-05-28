import { useCallback, useEffect, useState } from 'react'
import {
  getAuthSummary,
  getSyncMeta,
  signInWithEmail,
  signOutCloud,
  syncWithCloud,
  type AuthSummary,
  type SyncMeta,
  type SyncMode,
  type SyncSummary,
} from '../lib/cloudSync'

export function useAuth() {
  const [authSummary, setAuthSummary] = useState<AuthSummary>({
    configured: false,
    signedIn: false,
  })
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({})

  const refreshAuth = useCallback(async () => {
    const next = await getAuthSummary()
    setAuthSummary(next)
  }, [])

  useEffect(() => {
    void refreshAuth()
    const onFocus = () => {
      void refreshAuth()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshAuth])

  const handleSignIn = useCallback(async (email: string) => {
    await signInWithEmail(email)
  }, [])

  const handleSignOut = useCallback(async () => {
    await signOutCloud()
    await refreshAuth()
  }, [refreshAuth])

  const handleCloudSync = useCallback(async (mode: SyncMode): Promise<SyncSummary> => {
    const summary = await syncWithCloud(mode)
    setSyncMeta(getSyncMeta())
    await refreshAuth()
    return summary
  }, [refreshAuth])

  return {
    authSummary,
    syncMeta,
    refreshAuth,
    handleSignIn,
    handleSignOut,
    handleCloudSync,
  }
}
