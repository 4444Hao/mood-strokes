import { useCallback, useEffect, useState } from 'react'
import {
  getAuthSummary,
  getDisplayName,
  getSyncMeta,
  signInWithEmail,
  signOutCloud,
  syncWithCloud,
  updateDisplayName,
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
  const [displayName, setDisplayName] = useState<string | null>(null)

  const refreshAuth = useCallback(async () => {
    const next = await getAuthSummary()
    setAuthSummary(next)
    if (next.signedIn) {
      const name = await getDisplayName()
      setDisplayName(name)
    } else {
      setDisplayName(null)
    }
  }, [])

  const handleUpdateDisplayName = useCallback(async (name: string) => {
    await updateDisplayName(name)
    setDisplayName(name.trim() || null)
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
    displayName,
    refreshAuth,
    handleSignIn,
    handleSignOut,
    handleCloudSync,
    handleUpdateDisplayName,
  }
}
