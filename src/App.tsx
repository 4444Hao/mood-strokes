import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './App.css'
import { useAuth } from './hooks/useAuth'
import { useCuration } from './hooks/useCuration'
import type { SyncMode } from './lib/cloudSync'
import {
  formatCnDate,
  toDateKey,
  toMonthKey,
} from './lib/date'
import {
  listEntriesByMonth,
  saveOrUpdateEntry,
  getEntryByDate,
  clearAllEntries,
  exportEntriesPayload,
  importEntriesPayload,
  getStorageStats,
  type StorageStats,
} from './lib/storage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FeaturedPage } from './pages/FeaturedPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import type { MoodEntry, MoodFace } from './types/mood'

type PageId = 'today' | 'featured' | 'settings'
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type PageTab = {
  id: PageId
  label: string
}

const PAGE_TABS: PageTab[] = [
  { id: 'today', label: '今日' },
  { id: 'featured', label: '精选' },
  { id: 'settings', label: '设置' },
]

function hashToPage(hash: string): PageId | null {
  const page = hash.replace(/^#/, '')
  if (page === 'today' || page === 'featured' || page === 'settings') {
    return page
  }
  return null
}

function App() {
  const [showUpdate, setShowUpdate] = useState(false)

  const {
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdate(true)
    },
    onOfflineReady() {
      // first-time offline ready — silent
    },
  })

  const [activePage, setActivePage] = useState<PageId>(
    () => hashToPage(window.location.hash) ?? 'today',
  )
  const todayKey = toDateKey(new Date())
  const [entryDateKey, setEntryDateKey] = useState(todayKey)
  const [monthKey, setMonthKey] = useState(toMonthKey(todayKey))
  const [todayEntry, setTodayEntry] = useState<MoodEntry | undefined>(undefined)
  const [monthEntries, setMonthEntries] = useState<MoodEntry[]>([])
  const [storageStats, setStorageStats] = useState<StorageStats>({
    total: 0,
    parametric: 0,
    freehand: 0,
    expressive: 0,
    withNote: 0,
    localOnly: 0,
    dirty: 0,
    synced: 0,
  })
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const {
    authSummary,
    syncMeta,
    displayName,
    refreshAuth,
    handleSignIn,
    handleSignOut,
    handleCloudSync,
    handleUpdateDisplayName,
  } = useAuth()

  const {
    featuredTemplates,
    mySubmissions,
    reviewQueue,
    handleSubmitMood,
    handleWithdrawSubmission,
    handleApproveSubmission,
    handleRejectSubmission,
    handleFeatureSubmission,
  } = useCuration(authSummary)

  useEffect(() => {
    const onHashChange = () => {
      const page = hashToPage(window.location.hash)
      if (page) setActivePage(page)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const hash = window.location.hash
    // 保留 Supabase auth 回调的 hash（含 access_token），不要覆盖
    if (hash.includes('access_token') || hash.includes('error_description')) {
      return
    }
    const target = `#${activePage}`
    if (hash !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [activePage])

  const reloadEntries = useCallback(() => {
    setTodayEntry(getEntryByDate(entryDateKey))
    setMonthEntries(listEntriesByMonth(monthKey))
    setStorageStats(getStorageStats())
  }, [entryDateKey, monthKey])

  useEffect(() => {
    reloadEntries()
  }, [reloadEntries])

  useEffect(() => {
    const checkInstalled = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
      const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      setIsInstalled(standalone || iosStandalone)
    }
    checkInstalled()

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstallPromptEvent(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleSaveToday = useCallback(
    (note: string, face: MoodFace) => {
      saveOrUpdateEntry({
        date: entryDateKey,
        note,
        face,
      })
      reloadEntries()
    },
    [entryDateKey, reloadEntries],
  )

  const handleEntryDateChange = useCallback((nextDateKey: string) => {
    setEntryDateKey(nextDateKey)
    setMonthKey(toMonthKey(nextDateKey))
  }, [])

  const handleMonthChange = useCallback((nextMonthKey: string) => {
    setMonthKey(nextMonthKey)
  }, [])

  const handleClearLocal = useCallback(() => {
    clearAllEntries()
    reloadEntries()
  }, [reloadEntries])

  const handleImportLocal = useCallback(
    (jsonString: string) => {
      const result = importEntriesPayload(jsonString)
      reloadEntries()
      return result
    },
    [reloadEntries],
  )

  const handleExportLocal = useCallback(() => {
    const payload = exportEntriesPayload()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `three-line-mood-${timestamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }, [])

  const handleCloudSyncWithReload = useCallback(async (mode: SyncMode) => {
    const summary = await handleCloudSync(mode)
    reloadEntries()
    return summary
  }, [handleCloudSync, reloadEntries])

  const handleInstallApp = useCallback(async (): Promise<boolean> => {
    if (!installPromptEvent) {
      return false
    }
    await installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice
    setInstallPromptEvent(null)
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }, [installPromptEvent])

  const activeContent = useMemo(() => {
    if (activePage === 'settings') {
      return (
        <SettingsPage
          stats={storageStats}
          auth={authSummary}
          syncMeta={syncMeta}
          canInstallPrompt={Boolean(installPromptEvent)}
          isInstalled={isInstalled}
          onInstallApp={handleInstallApp}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSync={handleCloudSyncWithReload}
          onRefreshAuth={refreshAuth}
          displayName={displayName}
          onUpdateDisplayName={handleUpdateDisplayName}
          onExport={handleExportLocal}
          onImport={handleImportLocal}
          onClearLocal={handleClearLocal}
          mySubmissions={mySubmissions}
          reviewQueue={reviewQueue}
          onWithdrawSubmission={handleWithdrawSubmission}
          onApproveSubmission={handleApproveSubmission}
          onRejectSubmission={handleRejectSubmission}
          onFeatureSubmission={handleFeatureSubmission}
        />
      )
    }
    if (activePage === 'featured') {
      return <FeaturedPage templates={featuredTemplates} />
    }
    return (
      <TodayPage
        dateKey={entryDateKey}
        todayKey={todayKey}
        monthKey={monthKey}
        dateLabel={formatCnDate(entryDateKey)}
        entry={todayEntry}
        monthEntries={monthEntries}
        auth={authSummary}
        displayName={displayName}
        featuredTemplates={featuredTemplates}
        onDateChange={handleEntryDateChange}
        onMonthChange={handleMonthChange}
        onSave={handleSaveToday}
        onSubmitMood={handleSubmitMood}
      />
    )
  }, [
    activePage,
    authSummary,
    handleInstallApp,
    handleCloudSyncWithReload,
    handleClearLocal,
    handleExportLocal,
    handleSignIn,
    handleSignOut,
    handleSaveToday,
    handleEntryDateChange,
    handleMonthChange,
    refreshAuth,
    entryDateKey,
    installPromptEvent,
    isInstalled,
    monthEntries,
    monthKey,
    syncMeta,
    storageStats,
    todayEntry,
    todayKey,
    displayName,
    handleUpdateDisplayName,
    handleImportLocal,
    featuredTemplates,
    mySubmissions,
    reviewQueue,
    handleSubmitMood,
    handleWithdrawSubmission,
    handleApproveSubmission,
    handleRejectSubmission,
    handleFeatureSubmission,
  ])

  return (
    <div className="app-shell">
      <header className="app-bar">
        <span className="app-bar-brand">三笔心情</span>
        <nav className="main-tabs" aria-label="主页面">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-chip ${activePage === tab.id ? 'is-active' : ''}`}
              onClick={() => setActivePage(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        <ErrorBoundary>{activeContent}</ErrorBoundary>
      </main>

      {showUpdate && (
        <div className="update-toast">
          <span>有新版本可用</span>
          <button type="button" className="mini-chip" onClick={() => { updateServiceWorker(); setShowUpdate(false) }}>
            立即更新
          </button>
        </div>
      )}
    </div>
  )
}

export default App
