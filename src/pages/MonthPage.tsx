import { useEffect, useMemo, useState } from 'react'
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
  const updatedAtLabel = selectedEntry
    ? new Date(selectedEntry.updatedAt).toLocaleString('zh-CN', {
        hour12: false,
      })
    : undefined

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
          <p className="empty-tip">这一天没有留下脸，也没关系。</p>
        )}
      </section>
    </section>
  )
}
