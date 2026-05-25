import { useEffect, useMemo, useRef, useState } from 'react'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import { daysInMonth } from '../lib/date'
import type { MoodEntry } from '../types/mood'

type MonthPageProps = {
  monthKey: string
  monthLabel: string
  entries: MoodEntry[]
  canGoNext: boolean
  isCurrentMonth: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onBackCurrentMonth: () => void
}

type MonthViewMode = 'grid' | 'week' | 'hanger'

const EMPTY_DAY_QUOTES = [
  '空白的一天。',
  '有些日子，不需要定义。',
  '还没来得及记录呢。',
  '那天的心情，藏起来了。',
  '点击这里，补上三笔心情。',
  '这一天，没有留下笔画。',
]

function syncStatusLabel(entry: MoodEntry): string {
  if (entry.syncStatus === 'synced') {
    return '已同步'
  }
  if (entry.syncStatus === 'dirty') {
    return '待同步'
  }
  return '仅本地'
}

function syncStatusClass(entry: MoodEntry): string {
  if (entry.syncStatus === 'synced') {
    return 'is-synced'
  }
  if (entry.syncStatus === 'dirty') {
    return 'is-dirty'
  }
  return 'is-local'
}

function dateKeyOf(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, '0')}`
}

function quoteForDate(dateKey: string): string {
  let hash = 7
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) % 104729
  }
  return EMPTY_DAY_QUOTES[hash % EMPTY_DAY_QUOTES.length]
}

export function MonthPage({
  monthKey,
  monthLabel,
  entries,
  canGoNext,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onBackCurrentMonth,
}: MonthPageProps) {
  const [viewMode, setViewMode] = useState<MonthViewMode>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'grid'
    }
    return window.matchMedia('(max-width: 680px)').matches ? 'week' : 'grid'
  })
  const totalDays = daysInMonth(monthKey)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const entryByDay = useMemo(() => {
    const map = new Map<number, MoodEntry>()
    entries.forEach((entry) => {
      const day = Number(entry.date.slice(-2))
      map.set(day, entry)
    })
    return map
  }, [entries])
  const [selectedDay, setSelectedDay] = useState<number>(1)

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedDay(1)
      return
    }
    const latest = entries.reduce((max, item) => {
      const day = Number(item.date.slice(-2))
      return day > max ? day : max
    }, 1)
    setSelectedDay(latest)
  }, [entries, monthKey])

  const selectedEntry = entryByDay.get(selectedDay)
  const selectedDateLabel = `${monthLabel} ${selectedDay} 日`
  const selectedDateKey = dateKeyOf(monthKey, selectedDay)
  const emptyDayQuote = quoteForDate(selectedDateKey)
  const selectedWeekStart = Math.floor((selectedDay - 1) / 7) * 7 + 1
  const weekDays = Array.from({ length: 7 }, (_, i) => selectedWeekStart + i).filter((day) => day <= totalDays)
  const weekDayPages = useMemo(() => {
    const pages: number[][] = []
    for (let i = 0; i < weekDays.length; i += 3) {
      pages.push(weekDays.slice(i, i + 3))
    }
    return pages
  }, [weekDays])
  const selectedWeekPageIndex = Math.floor((selectedDay - selectedWeekStart) / 3)
  const canPrevWeek = selectedWeekStart > 1
  const canNextWeek = selectedWeekStart + 7 <= totalDays
  const weekCarouselRef = useRef<HTMLDivElement | null>(null)
  const updatedAtLabel = selectedEntry
    ? new Date(selectedEntry.updatedAt).toLocaleString('zh-CN', {
        hour12: false,
      })
    : undefined

  useEffect(() => {
    if (viewMode !== 'week') {
      return
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    if (!window.matchMedia('(max-width: 680px)').matches) {
      return
    }
    const host = weekCarouselRef.current
    if (!host) {
      return
    }
    const page = host.querySelector<HTMLElement>(`[data-week-page-index="${selectedWeekPageIndex}"]`)
    if (!page) {
      return
    }
    host.scrollTo({
      left: page.offsetLeft,
      behavior: 'smooth',
    })
  }, [selectedWeekPageIndex, viewMode])

  const renderWeekDayCard = (day: number, extraClassName = '') => {
    const entry = entryByDay.get(day)
    return (
      <article
        key={day}
        className={`week-day-card ${extraClassName} ${selectedDay === day ? 'is-selected' : ''} ${entry ? 'has-face' : 'is-empty'}`}
        onClick={() => setSelectedDay(day)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setSelectedDay(day)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${day}号${entry ? '有记录' : '无记录'}`}
      >
        <span className="day-label">{day}</span>
        {entry ? (
          <span
            className={`sync-dot ${syncStatusClass(entry)}`}
            title={syncStatusLabel(entry)}
            aria-label={syncStatusLabel(entry)}
          />
        ) : null}
        {entry ? (
          <MoodFaceSvg face={entry.face} className="week-face-thumb" />
        ) : (
          <div className="face-dot" aria-hidden>
            ·
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>这个月的你</h2>
        <p>{monthLabel}</p>
      </div>

      <div className="month-toolbar">
        <button type="button" className="ghost-btn" onClick={onPrevMonth}>
          上个月
        </button>
        <button type="button" className="ghost-btn" onClick={onNextMonth} disabled={!canGoNext}>
          下个月
        </button>
        <button type="button" className="ghost-btn" onClick={onBackCurrentMonth} disabled={isCurrentMonth}>
          回到本月
        </button>
      </div>

      <div className="month-view-toggle" role="tablist" aria-label="月历视图">
        <button
          type="button"
          className={`ghost-btn ${viewMode === 'week' ? 'is-active' : ''}`}
          onClick={() => setViewMode('week')}
          role="tab"
          aria-selected={viewMode === 'week'}
        >
          周视图
        </button>
        <button
          type="button"
          className={`ghost-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
          onClick={() => setViewMode('grid')}
          role="tab"
          aria-selected={viewMode === 'grid'}
        >
          全月预览
        </button>
        <button
          type="button"
          className={`ghost-btn ${viewMode === 'hanger' ? 'is-active' : ''}`}
          onClick={() => setViewMode('hanger')}
          role="tab"
          aria-selected={viewMode === 'hanger'}
        >
          挂历翻页
        </button>
      </div>

      {viewMode === 'week' ? (
        <>
          <div className="week-toolbar">
            <button
              type="button"
              className="ghost-btn"
              disabled={!canPrevWeek}
              onClick={() => setSelectedDay((day) => Math.max(1, day - 7))}
            >
              上一周
            </button>
            <p className="week-range">
              {selectedWeekStart} - {Math.min(totalDays, selectedWeekStart + 6)} 日
            </p>
            <button
              type="button"
              className="ghost-btn"
              disabled={!canNextWeek}
              onClick={() => setSelectedDay((day) => Math.min(totalDays, day + 7))}
            >
              下一周
            </button>
          </div>

          <div className="week-grid week-grid-desktop" aria-label="周视图表情墙">
            {weekDays.map((day) => renderWeekDayCard(day))}
          </div>
          <div className="week-carousel week-grid-mobile" aria-label="周视图表情墙" ref={weekCarouselRef}>
            {weekDayPages.map((group, groupIndex) => (
              <div key={groupIndex} className="week-page" data-week-page-index={groupIndex}>
                {group.map((day) => renderWeekDayCard(day, 'week-day-card-mobile'))}
              </div>
            ))}
          </div>

          <section className="month-detail">
            <h3 className="month-detail-title">{selectedDateLabel}</h3>
            {selectedEntry ? (
              <div className="month-detail-body">
                <MoodFaceSvg face={selectedEntry.face} className="month-face-large" />
                <div className="month-detail-copy">
                  <p className="month-detail-note">{selectedEntry.note || '今天没有留下备注。'}</p>
                  <p className="month-detail-meta">最后更新：{updatedAtLabel}</p>
                  <p className={`sync-pill ${syncStatusClass(selectedEntry)}`}>
                    同步状态：{syncStatusLabel(selectedEntry)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="empty-tip">{emptyDayQuote}</p>
            )}
          </section>
        </>
      ) : viewMode === 'grid' ? (
        <>
          <div className="calendar-grid" aria-label="月历表情墙">
            {days.map((day) => {
              const entry = entryByDay.get(day)
              return (
                <article
                  key={day}
                  className={`day-card ${selectedDay === day ? 'is-selected' : ''} ${entry ? 'has-face' : 'is-empty'}`}
                  onClick={() => setSelectedDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedDay(day)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${day}号${entry ? '有记录' : '无记录'}`}
                >
                  <span className="day-label">{day}</span>
                  {entry ? (
                    <span
                      className={`sync-dot ${syncStatusClass(entry)}`}
                      title={syncStatusLabel(entry)}
                      aria-label={syncStatusLabel(entry)}
                    />
                  ) : null}
                  {entry ? (
                    <MoodFaceSvg face={entry.face} className="month-face-thumb" />
                  ) : (
                    <div className="face-dot" aria-hidden>
                      ·
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <section className="month-detail">
            <h3 className="month-detail-title">{selectedDateLabel}</h3>

            {selectedEntry ? (
              <div className="month-detail-body">
                <MoodFaceSvg face={selectedEntry.face} className="month-face-large" />
                <div className="month-detail-copy">
                  <p className="month-detail-note">{selectedEntry.note || '今天没有留下备注。'}</p>
                  <p className="month-detail-meta">最后更新：{updatedAtLabel}</p>
                  <p className={`sync-pill ${syncStatusClass(selectedEntry)}`}>
                    同步状态：{syncStatusLabel(selectedEntry)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="empty-tip">{emptyDayQuote}</p>
            )}
          </section>
        </>
      ) : (
        <section className="month-hanger">
          <div className="month-hanger-nav">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setSelectedDay((day) => Math.max(1, day - 1))}
              disabled={selectedDay <= 1}
            >
              上一天
            </button>
            <p className="month-hanger-date">{selectedDateLabel}</p>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setSelectedDay((day) => Math.min(totalDays, day + 1))}
              disabled={selectedDay >= totalDays}
            >
              下一天
            </button>
          </div>

          <article className="month-hanger-sheet">
            {selectedEntry ? (
              <div className="month-detail-body">
                <MoodFaceSvg face={selectedEntry.face} className="month-face-large" />
                <div className="month-detail-copy">
                  <p className="month-detail-note">{selectedEntry.note || '今天没有留下备注。'}</p>
                  <p className="month-detail-meta">最后更新：{updatedAtLabel}</p>
                  <p className={`sync-pill ${syncStatusClass(selectedEntry)}`}>
                    同步状态：{syncStatusLabel(selectedEntry)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="month-hanger-empty">
                <p className="empty-tip">{emptyDayQuote}</p>
                <p className="month-detail-meta">可以切到今日页，为这一天补上三笔心情。</p>
              </div>
            )}
          </article>
        </section>
      )}
    </section>
  )
}
