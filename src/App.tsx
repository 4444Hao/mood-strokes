import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
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
} from './lib/cloudSync'
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
  clearAllEntries,
  exportEntriesPayload,
  getStorageStats,
  type StorageStats,
} from './lib/storage'
import { MonthPage } from './pages/MonthPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import type { MoodEntry, MoodFace } from './types/mood'

type PageId = 'today' | 'month' | 'settings'
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
  { id: 'settings', label: '设置' },
]

function App() {
  const [activePage, setActivePage] = useState<PageId>('today')
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
  const [authSummary, setAuthSummary] = useState<AuthSummary>({
    configured: false,
    signedIn: false,
  })
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({})
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const reloadEntries = useCallback(() => {
    setTodayEntry(getEntryByDate(entryDateKey))
    setMonthEntries(listEntriesByMonth(monthKey))
    setStorageStats(getStorageStats())
  }, [entryDateKey, monthKey])

  useEffect(() => {
    reloadEntries()
    setSyncMeta(getSyncMeta())
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

  const handleSignIn = useCallback(async (email: string) => {
    await signInWithEmail(email)
  }, [])

  const handleSignOut = useCallback(async () => {
    await signOutCloud()
    await refreshAuth()
  }, [refreshAuth])

  const handleCloudSync = useCallback(async (mode: SyncMode): Promise<SyncSummary> => {
    const summary = await syncWithCloud(mode)
    reloadEntries()
    setSyncMeta(getSyncMeta())
    await refreshAuth()
    return summary
  }, [refreshAuth, reloadEntries])

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
          onSync={handleCloudSync}
          onRefreshAuth={refreshAuth}
          onExport={handleExportLocal}
          onClearLocal={handleClearLocal}
        />
      )
    }
    return (
      <TodayPage
        dateKey={entryDateKey}
        maxDateKey={todayKey}
        dateLabel={formatCnDate(entryDateKey)}
        entry={todayEntry}
        onDateChange={handleEntryDateChange}
        onSave={handleSaveToday}
      />
    )
  }, [
    activePage,
    authSummary,
    handleInstallApp,
    handleCloudSync,
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
  ])

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="app-mark">三笔心情</p>
        <h1 className="app-title">今天的你，是哪张脸？</h1>
        <p className="app-subtitle">拖一拖，画出今天。</p>
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

      <main className="main-content">{activeContent}</main>
    </div>
  )
}

export default App
