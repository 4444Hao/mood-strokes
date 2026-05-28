import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { useAuth } from './hooks/useAuth'
import { useCuration } from './hooks/useCuration'
import type { SyncMode } from './lib/cloudSync'
import {
  compareMonthKey,
  formatCnDate,
  formatCnMonth,
  shiftMonthKey,
  toDateKey,
  toMonthKey,
} from './lib/date'
import {
  listEntriesByMonth,
  saveOrUpdateEntry,
  getEntryByDate,
  getEarliestDateKey,
  clearAllEntries,
  exportEntriesPayload,
  importEntriesPayload,
  getStorageStats,
  type StorageStats,
} from './lib/storage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MonthPage } from './pages/MonthPage'
import { FeaturedPage } from './pages/FeaturedPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import type { MoodEntry, MoodFace } from './types/mood'

type PageId = 'today' | 'month' | 'featured' | 'settings'
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
  { id: 'month', label: '月历' },
  { id: 'featured', label: '精选' },
  { id: 'settings', label: '设置' },
]

const FALLBACK_EARLIEST_DATE = '2026-05-01'

function hashToPage(hash: string): PageId | null {
  const page = hash.replace(/^#/, '')
  if (page === 'today' || page === 'month' || page === 'featured' || page === 'settings') {
    return page
  }
  return null
}

function App() {
  const earliestDateKey = getEarliestDateKey() ?? FALLBACK_EARLIEST_DATE
  const [activePage, setActivePage] = useState<PageId>(
    () => hashToPage(window.location.hash) ?? 'today',
  )
  const todayKey = toDateKey(new Date())
  const [entryDateKey, setEntryDateKey] = useState(todayKey)
  const currentMonthKey = toMonthKey(todayKey)
  const [monthKey, setMonthKey] = useState(currentMonthKey)
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
    refreshAuth,
    handleSignIn,
    handleSignOut,
    handleCloudSync,
  } = useAuth()

  const {
    featuredTemplates,
    hasMore,
    loadMoreFeatured,
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
    const target = `#${activePage}`
    if (window.location.hash !== target) {
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

  const handlePrevMonth = useCallback(() => {
    setMonthKey((prev) => shiftMonthKey(prev, -1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setMonthKey((prev) => {
      const next = shiftMonthKey(prev, 1)
      if (compareMonthKey(next, currentMonthKey) > 0) {
        return prev
      }
      return next
    })
  }, [currentMonthKey])

  const handleBackCurrentMonth = useCallback(() => {
    setMonthKey(currentMonthKey)
  }, [currentMonthKey])

  const handleJumpToDate = useCallback((dateKey: string) => {
    setEntryDateKey(dateKey)
    setMonthKey(toMonthKey(dateKey))
    setActivePage('today')
  }, [])

  const activeContent = useMemo(() => {
    if (activePage === 'month') {
      return (
        <MonthPage
          monthLabel={formatCnMonth(monthKey)}
          monthKey={monthKey}
          entries={monthEntries}
          canGoNext={compareMonthKey(monthKey, currentMonthKey) < 0}
          isCurrentMonth={compareMonthKey(monthKey, currentMonthKey) === 0}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onBackCurrentMonth={handleBackCurrentMonth}
          onJumpToDate={handleJumpToDate}
        />
      )
    }
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
      return (
        <FeaturedPage
          templates={featuredTemplates}
          hasMore={hasMore}
          onLoadMore={loadMoreFeatured}
        />
      )
    }
    return (
      <TodayPage
        dateKey={entryDateKey}
        minDateKey={earliestDateKey}
        maxDateKey={todayKey}
        dateLabel={formatCnDate(entryDateKey)}
        entry={todayEntry}
        auth={authSummary}
        featuredTemplates={featuredTemplates}
        onDateChange={handleEntryDateChange}
        onSave={handleSaveToday}
        onSubmitMood={handleSubmitMood}
      />
    )
  }, [
    activePage,
    authSummary,
    handleInstallApp,
    handleCloudSyncWithReload,
    handleBackCurrentMonth,
    handleClearLocal,
    handleExportLocal,
    handleNextMonth,
    handlePrevMonth,
    handleSignIn,
    handleSignOut,
    handleSaveToday,
    handleEntryDateChange,
    refreshAuth,
    entryDateKey,
    installPromptEvent,
    isInstalled,
    monthEntries,
    monthKey,
    syncMeta,
    storageStats,
    currentMonthKey,
    todayEntry,
    todayKey,
    earliestDateKey,
    hasMore,
    loadMoreFeatured,
    handleImportLocal,
    handleJumpToDate,
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
      <header className="app-header">
        <p className="app-mark">三笔心情</p>
        <h1 className="app-title">三笔极简，情绪万千。</h1>
        <p className="app-subtitle">今天的你，是哪张脸？</p>
      </header>

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

      <main className="main-content">
        <ErrorBoundary>{activeContent}</ErrorBoundary>
      </main>
    </div>
  )
}

export default App
