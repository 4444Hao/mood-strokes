import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HeatmapCalendar } from '../components/HeatmapCalendar'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import { ThreeStrokeMoodEditor } from '../components/ThreeStrokeMoodEditor'
import type { AuthSummary } from '../lib/cloudSync'
import { daysInMonth, formatCnMonth, toMonthKey } from '../lib/date'
import type { FeaturedTemplate, SubmitMoodPayload } from '../types/curation'
import type { MoodEntry, MoodFace } from '../types/mood'

type TodayPageProps = {
  dateKey: string
  todayKey: string
  monthKey: string
  dateLabel: string
  entry?: MoodEntry
  monthEntries: MoodEntry[]
  auth: AuthSummary
  featuredTemplates: FeaturedTemplate[]
  onDateChange: (dateKey: string) => void
  onMonthChange: (monthKey: string) => void
  onSave: (note: string, face: MoodFace) => void
  onSubmitMood: (payload: SubmitMoodPayload) => Promise<void>
}

type FoldSection = 'heatmap' | 'templates' | 'submit' | null

const NOTE_PROMPTS = [
  '心似白云常自在，意如流水任东西。',
  '平静本身就是一种答案。',
  '今天有微小的快乐发生。',
  '嘴角没下来过。',
  '阳光正好，我也很好。',
  '没什么，就是有点累。',
  '说不清，但和昨天不太一样。',
  '介于微笑和叹气之间。',
  '三笔极简，情绪万千。',
  '嘿嘿。',
]

function promptForDate(dateKey: string): string {
  const key = dateKey || '2026-05-01'
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0
  return NOTE_PROMPTS[hash % NOTE_PROMPTS.length]
}

function dateKeyOf(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, '0')}`
}

export function TodayPage({
  dateKey, todayKey, monthKey, dateLabel, entry, monthEntries,
  auth, featuredTemplates, onDateChange, onMonthChange, onSave, onSubmitMood,
}: TodayPageProps) {
  const [note, setNote] = useState('')
  const [face, setFace] = useState<MoodFace | undefined>(undefined)
  const [savedHint, setSavedHint] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false)
  const [templateConfirmFace, setTemplateConfirmFace] = useState<MoodFace | null>(null)
  const [undoEntry, setUndoEntry] = useState<MoodEntry | null>(null)
  const [foldSection, setFoldSection] = useState<FoldSection>(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [submitHint, setSubmitHint] = useState('')
  const [consentPublic, setConsentPublic] = useState(false)
  const [consentTemplate, setConsentTemplate] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [shareCaption, setShareCaption] = useState('')
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const isToday = dateKey === todayKey
  const selectedDay = Number(dateKey.slice(-2))
  const todayDay = Number(todayKey.slice(-2))
  const totalDays = daysInMonth(monthKey)
  const isCurrentMonth = toMonthKey(todayKey) === monthKey
  const notePrompt = promptForDate(dateKey)

  const recordedDays = useMemo(() => {
    const set = new Set<number>()
    monthEntries.forEach((e) => {
      const d = Number(e.date.slice(-2))
      if (d >= 1 && d <= 31) set.add(d)
    })
    return set
  }, [monthEntries])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setNote(entry?.note ?? '')
    setFace(entry?.face)
    setSavedHint('')
    setSaveBusy(false)
    setSaveDone(false)
    setSubmitDone(false)
    setOverwriteConfirmOpen(false)
  }, [entry?.id, entry?.note, entry?.face])

  const flipTo = useCallback((dir: 'prev' | 'next') => {
    const day = Number(dateKey.slice(-2))
    if (dir === 'prev' && day <= 1) {
      const [y, m] = monthKey.split('-').map(Number)
      const prevDate = new Date(y, m - 2, 1)
      const pmk = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
      const pd = daysInMonth(pmk)
      onDateChange(`${pmk}-${String(pd).padStart(2, '0')}`)
      return
    }
    if (dir === 'next' && day >= totalDays) {
      if (isCurrentMonth) return
      const [y, m] = monthKey.split('-').map(Number)
      const nmk = `${y}-${String(m + 1).padStart(2, '0')}`
      onDateChange(`${nmk}-01`)
      return
    }
    if (dir === 'prev') onDateChange(dateKeyOf(monthKey, Math.max(1, day - 1)))
    else onDateChange(dateKeyOf(monthKey, Math.min(totalDays, day + 1)))
  }, [dateKey, monthKey, totalDays, isCurrentMonth, onDateChange])

  const handleSelectDay = useCallback((day: number) => {
    const newKey = dateKeyOf(monthKey, day)
    if (newKey === dateKey) return
    onDateChange(newKey)
  }, [dateKey, monthKey, onDateChange])

  const handleBackToday = useCallback(() => {
    if (dateKey === todayKey) return
    onDateChange(todayKey)
  }, [dateKey, todayKey, onDateChange])

  const toggleFold = (section: FoldSection) => {
    setFoldSection((prev) => (prev === section ? null : section))
  }

  const executeSave = () => {
    if (!face || saveBusy) return
    const previous = entry
    setSaveBusy(true)
    setSaveDone(false)
    setSavedHint('')
    setUndoEntry(null)
    if (undoRef.current) clearTimeout(undoRef.current)
    try {
      onSave(note, face)
      if (previous) {
        setUndoEntry(previous)
        undoRef.current = window.setTimeout(() => { setUndoEntry(null); undoRef.current = null }, 30000)
      }
      setSavedHint(entry ? '已覆盖。' : '已保存。')
      setSaveDone(true)
      window.setTimeout(() => { if (mountedRef.current) setSaveDone(false) }, 1400)
    } finally {
      window.setTimeout(() => { if (mountedRef.current) setSaveBusy(false) }, 260)
      setOverwriteConfirmOpen(false)
    }
  }

  const handleUndoSave = () => {
    if (!undoEntry) return
    onSave(undoEntry.note ?? '', undoEntry.face)
    setUndoEntry(null)
    if (undoRef.current) { clearTimeout(undoRef.current); undoRef.current = null }
    setSavedHint('已撤销保存。')
  }

  const handleSave = () => {
    if (!face || saveBusy) return
    if (entry) { setOverwriteConfirmOpen(true); return }
    executeSave()
  }

  const handleSubmit = async () => {
    if (!face) { setSubmitHint('先画好今天的脸。'); return }
    if (!navigator.onLine) { setSubmitHint('离线状态，请连接网络。'); return }
    if (!auth.configured) { setSubmitHint('请先配置 Supabase。'); return }
    if (!auth.signedIn) { setSubmitHint('请先登录。'); return }
    if (!consentPublic || !consentTemplate) { setSubmitHint('请勾选公开展示与模板授权。'); return }
    try {
      setSubmitBusy(true)
      setSubmitDone(false)
      setSubmitHint('上传中...')
      await onSubmitMood({ entryDate: dateKey, face, note, shareCaption, consentPublic, consentTemplate, isAnonymous })
      setSubmitHint('投稿已提交。')
      setSubmitDone(true)
      window.setTimeout(() => { if (mountedRef.current) setSubmitDone(false) }, 1600)
    } catch (error) {
      setSubmitHint(error instanceof Error ? error.message : '投稿失败。')
    } finally { setSubmitBusy(false) }
  }

  return (
    <section className="panel panel-compact">
      {/* ── 翻页导航 ── */}
      <div className="flip-nav">
        <button type="button" className="ghost-btn flip-nav-btn" onClick={() => flipTo('prev')}
          disabled={!isCurrentMonth && selectedDay <= 1 ? false : selectedDay <= 1 && isCurrentMonth}>
          ◀
        </button>
        <span className="flip-nav-label">
          {dateLabel}
          {!isToday && (
            <button type="button" className="mini-chip" onClick={handleBackToday} style={{ marginLeft: '0.4rem' }}>
              回到今天
            </button>
          )}
        </span>
        <button type="button" className="ghost-btn flip-nav-btn" onClick={() => flipTo('next')}
          disabled={isCurrentMonth && selectedDay >= totalDays}>
          ▶
        </button>
      </div>

      {/* ── 画板 ── */}
      <div className="editor-stage">
        <ThreeStrokeMoodEditor value={face} onChange={setFace} />
      </div>

      {/* ── 备注 + 保存 ── */}
      <div className="note-save-row">
        <textarea
          className="note-textarea"
          rows={2}
          maxLength={120}
          placeholder={notePrompt}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="note-save-actions">
          <button
            type="button"
            className={`primary-btn ${saveBusy ? 'is-loading' : ''} ${saveDone ? 'is-success' : ''}`}
            onClick={handleSave}
            disabled={!face || saveBusy}
          >
            {saveBusy ? <><span className="btn-spinner" aria-hidden />...</> : saveDone ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {overwriteConfirmOpen && (
        <div className="block save-choice-card">
          <p className="block-note">这一天已有记录，覆盖保存？</p>
          <div className="settings-actions">
            <button type="button" className="ghost-btn" onClick={executeSave}>覆盖</button>
            <button type="button" className="ghost-btn warn" onClick={() => setOverwriteConfirmOpen(false)}>取消</button>
          </div>
        </div>
      )}

      {savedHint && <p className="saved-hint">{savedHint}</p>}
      {undoEntry && (
        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={handleUndoSave}>撤销保存</button>
          <span className="editor-hint">（30 秒内可撤销）</span>
        </div>
      )}

      {/* ── 折叠入口行 ── */}
      <div className="fold-bar">
        <button type="button" className={`mini-chip ${foldSection === 'heatmap' ? 'is-active' : ''}`}
          onClick={() => toggleFold('heatmap')}>
          📅 月历
        </button>
        {featuredTemplates.length > 0 && (
          <button type="button" className={`mini-chip ${foldSection === 'templates' ? 'is-active' : ''}`}
            onClick={() => toggleFold('templates')}>
            📁 模板
          </button>
        )}
        <button type="button" className={`mini-chip ${foldSection === 'submit' ? 'is-active' : ''}`}
          onClick={() => toggleFold('submit')}>
          ✉ 投稿
        </button>
      </div>

      {/* ── 折叠内容区 ── */}
      {foldSection === 'heatmap' && (
        <HeatmapCalendar
          monthKey={monthKey}
          monthLabel={formatCnMonth(monthKey)}
          selectedDay={selectedDay}
          todayDay={todayDay}
          isCurrentMonth={isCurrentMonth}
          recordedDays={recordedDays}
          onSelectDay={handleSelectDay}
          onPrevMonth={() => onMonthChange(shiftMonthKey(monthKey, -1))}
          onNextMonth={() => {
            const next = shiftMonthKey(monthKey, 1)
            if (toMonthKey(todayKey) >= next) onMonthChange(next)
          }}
        />
      )}

      {foldSection === 'templates' && (
        <div className="block">
          <p className="block-note">选一张作为起点，再继续微调。</p>
          <div className="template-grid">
            {featuredTemplates.map((t) => (
              <button key={t.id} type="button" className="template-card"
                onClick={() => {
                  if (face) setTemplateConfirmFace(t.face)
                  else setFace(t.face)
                }}>
                <MoodFaceSvg face={t.face} className="template-face" />
                <span className="template-title">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {templateConfirmFace && (
        <div className="block save-choice-card">
          <p className="block-note">替换当前绘制？</p>
          <div className="settings-actions">
            <button type="button" className="ghost-btn" onClick={() => { setFace(templateConfirmFace); setTemplateConfirmFace(null) }}>
              确认替换
            </button>
            <button type="button" className="ghost-btn warn" onClick={() => setTemplateConfirmFace(null)}>取消</button>
          </div>
        </div>
      )}

      {foldSection === 'submit' && (
        <div className="block">
          <p className="block-note">分享到精选池，默认仅自己可见。</p>
          <label className="consent-row">
            <input type="checkbox" checked={consentPublic} onChange={(e) => setConsentPublic(e.target.checked)} />
            <span>同意公开展示</span>
          </label>
          <label className="consent-row">
            <input type="checkbox" checked={consentTemplate} onChange={(e) => setConsentTemplate(e.target.checked)} />
            <span>同意作为模板使用</span>
          </label>
          <label className="consent-row">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
            <span>匿名展示</span>
          </label>
          <input className="settings-input" type="text" placeholder="可选：一句分享语" value={shareCaption}
            maxLength={60} onChange={(e) => setShareCaption(e.target.value)} />
          <div className="settings-actions" style={{ marginTop: '0.4rem' }}>
            <button type="button" className={`ghost-btn ${submitBusy ? 'is-loading' : ''} ${submitDone ? 'is-success' : ''}`}
              onClick={() => void handleSubmit()} disabled={submitBusy}>
              {submitBusy ? '上传中...' : submitDone ? '已提交' : '上传到精选池'}
            </button>
          </div>
          {submitHint && <p className="editor-hint" style={{ marginTop: '0.3rem' }}>{submitHint}</p>}
        </div>
      )}
    </section>
  )
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}
