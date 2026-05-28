import { useMemo } from 'react'
import { daysInMonth } from '../lib/date'

type HeatmapCalendarProps = {
  monthKey: string
  monthLabel: string
  selectedDay: number
  todayDay: number
  isCurrentMonth: boolean
  recordedDays: Set<number>
  onSelectDay: (day: number) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function firstDayOfWeekOffset(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(year, month - 1, 1).getDay()
  return first === 0 ? 6 : first - 1
}

export function HeatmapCalendar({
  monthKey,
  monthLabel,
  selectedDay,
  todayDay,
  isCurrentMonth,
  recordedDays,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: HeatmapCalendarProps) {
  const totalDays = daysInMonth(monthKey)
  const offset = firstDayOfWeekOffset(monthKey)

  const cells = useMemo(() => {
    const result: Array<{ day: number | null; key: string }> = []
    for (let i = 0; i < offset; i += 1) {
      result.push({ day: null, key: `empty-${i}` })
    }
    for (let d = 1; d <= totalDays; d += 1) {
      result.push({ day: d, key: `d-${d}` })
    }
    return result
  }, [offset, totalDays])

  return (
    <div className="heatmap">
      <div className="heatmap-head">
        <button type="button" className="ghost-btn heatmap-month-btn" onClick={onPrevMonth}>
          ◀
        </button>
        <span className="heatmap-month-label">{monthLabel}</span>
        <button
          type="button"
          className="ghost-btn heatmap-month-btn"
          onClick={onNextMonth}
          disabled={isCurrentMonth}
        >
          ▶
        </button>
      </div>

      <div className="heatmap-grid" role="grid" aria-label="记录热力图">
        <div className="heatmap-row heatmap-header-row" role="row">
          {DAY_LABELS.map((label) => (
            <span key={label} className="heatmap-cell heatmap-day-label" role="columnheader">
              {label}
            </span>
          ))}
        </div>

        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIdx) => (
          <div key={`row-${rowIdx}`} className="heatmap-row" role="row">
            {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell) => {
              if (cell.day === null) {
                return <span key={cell.key} className="heatmap-cell heatmap-empty" />
              }
              const hasRecord = recordedDays.has(cell.day)
              const isSelected = cell.day === selectedDay
              const isToday = isCurrentMonth && cell.day === todayDay

              let className = 'heatmap-cell heatmap-dot'
              if (hasRecord) className += ' has-record'
              if (isSelected) className += ' is-selected'
              if (isToday) className += ' is-today'

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={className}
                  onClick={() => onSelectDay(cell.day!)}
                  aria-label={`${cell.day}号${hasRecord ? '有记录' : '无记录'}${isToday ? '今天' : ''}`}
                >
                  <span className="heatmap-dot-inner">{cell.day}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
