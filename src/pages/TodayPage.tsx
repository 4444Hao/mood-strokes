import { useEffect, useState } from 'react'
import { ThreeStrokeMoodEditor } from '../components/ThreeStrokeMoodEditor'
import type { MoodEntry } from '../types/mood'
import type { MoodFace } from '../types/mood'

type TodayPageProps = {
  dateKey: string
  maxDateKey: string
  dateLabel: string
  entry?: MoodEntry
  onDateChange: (dateKey: string) => void
  onSave: (note: string, face: MoodFace) => void
}

function syncStatusLabel(entry?: MoodEntry): string {
  if (!entry) {
    return '尚未保存'
  }
  if (entry.syncStatus === 'synced') {
    return '已同步'
  }
  if (entry.syncStatus === 'dirty') {
    return '待同步'
  }
  return '仅本地'
}

function syncStatusClass(entry?: MoodEntry): string {
  if (!entry) {
    return 'is-local'
  }
  if (entry.syncStatus === 'synced') {
    return 'is-synced'
  }
  if (entry.syncStatus === 'dirty') {
    return 'is-dirty'
  }
  return 'is-local'
}

export function TodayPage({
  dateKey,
  maxDateKey,
  dateLabel,
  entry,
  onDateChange,
  onSave,
}: TodayPageProps) {
  const [note, setNote] = useState('')
  const [face, setFace] = useState<MoodFace | undefined>(undefined)
  const [savedHint, setSavedHint] = useState('')

  useEffect(() => {
    setNote(entry?.note ?? '')
    setFace(entry?.face)
    setSavedHint('')
  }, [entry?.id, entry?.note, entry?.face])

  const handleSave = () => {
    if (!face) {
      return
    }
    onSave(note, face)
    setSavedHint('今天的脸已经收好了。')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>今日页面</h2>
        <p>{dateLabel}</p>
        <p className={`sync-pill ${syncStatusClass(entry)}`}>同步状态：{syncStatusLabel(entry)}</p>
      </div>

      <label className="date-picker-row">
        <span>记录日期</span>
        <input
          type="date"
          value={dateKey}
          max={maxDateKey}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>

      <div className="block editor-stage">
        <p className="block-title">三笔心情</p>
        <ThreeStrokeMoodEditor value={face} onChange={setFace} />
      </div>

      <label className="note-box">
        <span>要不要留下一句话？</span>
        <textarea
          rows={3}
          maxLength={120}
          placeholder="今天只是有点累。"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <button type="button" className="primary-btn" onClick={handleSave} disabled={!face}>
        保存今天的脸
      </button>

      {savedHint ? <p className="saved-hint">{savedHint}</p> : null}
    </section>
  )
}
