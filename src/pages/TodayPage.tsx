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
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 33 + key.charCodeAt(i)) >>> 0
  }
  return NOTE_PROMPTS[hash % NOTE_PROMPTS.length]
}

function dateKeyOf(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, '0')}`
}

function syncStatusLabel(entry?: MoodEntry): string {
  if (!entry) return '尚未保存'
  if (entry.syncStatus === 'synced') return '已同步'
  if (entry.syncStatus === 'dirty') return '待同步'
  return '仅本地'
}

function syncStatusClass(entry?: MoodEntry): string {
  if (!entry) return 'is-local'
  if (entry.syncStatus === 'synced') return 'is-synced'
  if (entry.syncStatus === 'dirty') return 'is-dirty'
  return 'is-local'
}

const EMPTY_QUOTES = [
  '空白的一天。',
  '有些日子，不需要定义。',
  '还没来得及记录呢。',
  '那天的心情，藏起来了。',
  '点击热力图，补上三笔心情。',
  '这一天，没有留下笔画。',
]

function quoteForDate(dateKey: string): string {
  let hash = 7
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) % 104729
  }
  return EMPTY_QUOTES[hash % EMPTY_QUOTES.length]
}

export function TodayPage({
  dateKey,
  todayKey,
  monthKey,
  dateLabel,
  entry,
  monthEntries,
  auth,
  featuredTemplates,
  onDateChange,
  onMonthChange,
  onSave,
  onSubmitMood,
}: TodayPageProps) {
  const [note, setNote] = useState('')
  const [face, setFace] = useState<MoodFace | undefined>(undefined)
  const [savedHint, setSavedHint] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [consentPublic, setConsentPublic] = useState(false)
  const [consentTemplate, setConsentTemplate] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [shareCaption, setShareCaption] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [submitHint, setSubmitHint] = useState('')
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false)
  const [templateConfirmFace, setTemplateConfirmFace] = useState<MoodFace | null>(null)
  const [undoEntry, setUndoEntry] = useState<MoodEntry | null>(null)
  const [flipDir, setFlipDir] = useState<'left' | 'right' | null>(null)
  const [flipKey, setFlipKey] = useState(0)
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notePrompt = promptForDate(dateKey)
  const mountedRef = useRef(true)
  const isToday = dateKey === todayKey
  const selectedDay = Number(dateKey.slice(-2))
  const todayDay = Number(todayKey.slice(-2))
  const totalDays = daysInMonth(monthKey)
  const isCurrentMonth = toMonthKey(todayKey) === monthKey

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
    return () => {
      mountedRef.current = false
    }
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

  const flipTo = useCallback(
    (dir: 'prev' | 'next') => {
      const day = Number(dateKey.slice(-2))
      if (dir === 'prev' && day <= 1) {
        const [y, m] = monthKey.split('-').map(Number)
        const prevDate = new Date(y, m - 2, 1)
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
        const prevDays = daysInMonth(prevMonthKey)
        const newKey = `${prevMonthKey}-${String(prevDays).padStart(2, '0')}`
        onDateChange(newKey)
        return
      }
      if (dir === 'next' && day >= totalDays) {
        if (isCurrentMonth) return
        const [y, m] = monthKey.split('-').map(Number)
        const nextDate = new Date(y, m, 1)
        const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
        onDateChange(`${nextMonthKey}-01`)
        return
      }
      setFlipDir(dir === 'prev' ? 'left' : 'right')
      setFlipKey((k) => k + 1)
      window.setTimeout(() => setFlipDir(null), 280)
      if (dir === 'prev') {
        const newDay = Math.max(1, day - 1)
        onDateChange(dateKeyOf(monthKey, newDay))
      } else {
        const newDay = Math.min(totalDays, day + 1)
        onDateChange(dateKeyOf(monthKey, newDay))
      }
    },
    [dateKey, monthKey, totalDays, isCurrentMonth, onDateChange],
  )

  const handleSelectDay = useCallback(
    (day: number) => {
      const newKey = dateKeyOf(monthKey, day)
      if (newKey === dateKey) return
      setFlipDir(Number(dateKey.slice(-2)) < day ? 'right' : 'left')
      setFlipKey((k) => k + 1)
      window.setTimeout(() => setFlipDir(null), 280)
      onDateChange(newKey)
    },
    [dateKey, monthKey, onDateChange],
  )

  const handleBackToday = useCallback(() => {
    if (dateKey === todayKey) return
    setFlipDir(Number(dateKey.slice(-2)) < todayDay ? 'right' : 'left')
    setFlipKey((k) => k + 1)
    window.setTimeout(() => setFlipDir(null), 280)
    onDateChange(todayKey)
  }, [dateKey, todayKey, todayDay, onDateChange])

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
        undoRef.current = window.setTimeout(() => {
          setUndoEntry(null)
          undoRef.current = null
        }, 30000)
      }
      setSavedHint(entry ? '已覆盖这天。' : '这张脸已经收好了。')
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
    if (undoRef.current) {
      clearTimeout(undoRef.current)
      undoRef.current = null
    }
    setSavedHint('已撤销保存，恢复为之前的内容。')
  }

  const handleSave = () => {
    if (!face || saveBusy) return
    if (entry) {
      setOverwriteConfirmOpen(true)
      return
    }
    executeSave()
  }

  const handleSubmit = async () => {
    if (!face) {
      setSubmitHint('先画好今天的脸，再上传到精选池。')
      return
    }
    if (!navigator.onLine) {
      setSubmitHint('当前处于离线状态，请连接网络后再投稿。')
      return
    }
    if (!auth.configured) {
      setSubmitHint('请先配置 Supabase，开启登录与投稿能力。')
      return
    }
    if (!auth.signedIn) {
      setSubmitHint('请先登录，再上传你的作品。')
      return
    }
    if (!consentPublic || !consentTemplate) {
      setSubmitHint('请先勾选公开展示与模板授权。')
      return
    }

    try {
      setSubmitBusy(true)
      setSubmitDone(false)
      setSubmitHint('上传中...')
      await onSubmitMood({
        entryDate: dateKey,
        face,
        note,
        shareCaption,
        consentPublic,
        consentTemplate,
        isAnonymous,
      })
      setSubmitHint('投稿已提交。你可以在设置页查看审核状态。')
      setSubmitDone(true)
      window.setTimeout(() => { if (mountedRef.current) setSubmitDone(false) }, 1600)
    } catch (error) {
      const message = error instanceof Error ? error.message : '投稿失败，请稍后再试。'
      setSubmitHint(message)
    } finally {
      setSubmitBusy(false)
    }
  }

  const updatedAtLabel = entry
    ? new Date(entry.updatedAt).toLocaleString('zh-CN', { hour12: false })
    : undefined

  const flipClass = flipDir ? `flip-${flipDir}` : ''

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>今日</h2>
        <p>{dateLabel}</p>
      </div>

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

      <div className="hanger-book-pages" style={{ marginTop: '0.3rem' }}>
        <div className="hanger-book-stack" aria-hidden />
        <div className="hanger-book-stack" aria-hidden />

        <article key={flipKey} className={`hanger-book-leaf ${flipClass}`}>
          <div
            className="click-zone prev"
            onClick={() => flipTo('prev')}
            role="button"
            tabIndex={-1}
            aria-label="翻到上一天"
          />
          <div
            className="click-zone next"
            onClick={() => flipTo('next')}
            role="button"
            tabIndex={-1}
            aria-label="翻到下一天"
          />

          {entry ? (
            <div className="month-detail-body">
              <MoodFaceSvg face={entry.face} className="month-face-large" />
              <div className="month-detail-copy">
                <p className="month-detail-note">{entry.note || '今天没有留下备注。'}</p>
                <p className="month-detail-meta">最后更新：{updatedAtLabel}</p>
                <p className={`sync-pill ${syncStatusClass(entry)}`}>
                  同步状态：{syncStatusLabel(entry)}
                </p>
              </div>
            </div>
          ) : (
            <div className="hanger-book-empty">
              <p className="empty-tip">{quoteForDate(dateKey)}</p>
            </div>
          )}
        </article>

        <div className="hanger-book-footer">
          <p className="hanger-book-page-num">
            第 {selectedDay} / {totalDays} 页
          </p>
          {!isToday ? (
            <button type="button" className="ghost-btn" onClick={handleBackToday}>
              回到今天
            </button>
          ) : null}
        </div>
      </div>

      {featuredTemplates.length > 0 ? (
        <div className="block">
          <p className="block-title">从精选模板开始</p>
          <p className="block-note">选一张作为起点，再继续微调。</p>
          <div className="template-grid">
            {featuredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="template-card"
                onClick={() => {
                  if (face) {
                    setTemplateConfirmFace(template.face)
                  } else {
                    setFace(template.face)
                  }
                }}
              >
                <MoodFaceSvg face={template.face} className="template-face" />
                <span className="template-title">{template.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {templateConfirmFace ? (
        <div className="block save-choice-card" role="group" aria-label="模板替换确认">
          <p className="block-title">是否使用模板开始？</p>
          <p className="block-note">当前已绘制的表情将被替换为模板内容。</p>
          <div className="settings-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setFace(templateConfirmFace)
                setTemplateConfirmFace(null)
              }}
            >
              确认替换
            </button>
            <button type="button" className="ghost-btn warn" onClick={() => setTemplateConfirmFace(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="block editor-stage">
        <p className="block-title">三笔心情</p>
        <ThreeStrokeMoodEditor value={face} onChange={setFace} />
      </div>

      <label className="note-box">
        <span>简单描述复杂的心...</span>
        <p className="editor-hint">{notePrompt}</p>
        <textarea
          rows={3}
          maxLength={120}
          placeholder={notePrompt}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <button
        type="button"
        className={`primary-btn ${saveBusy ? 'is-loading' : ''} ${saveDone ? 'is-success' : ''}`}
        onClick={handleSave}
        disabled={!face || saveBusy}
      >
        {saveBusy ? <><span className="btn-spinner" aria-hidden />保存中...</> : saveDone ? '已保存' : '保存'}
      </button>
      {overwriteConfirmOpen ? (
        <div className="block save-choice-card" role="group" aria-label="覆盖确认">
          <p className="block-title">这一天已经有一张表情</p>
          <p className="block-note">再保存会覆盖，是否继续？</p>
          <div className="settings-actions">
            <button type="button" className="ghost-btn" onClick={executeSave}>覆盖保存</button>
            <button type="button" className="ghost-btn warn" onClick={() => setOverwriteConfirmOpen(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {savedHint ? <p className="saved-hint">{savedHint}</p> : null}

      {undoEntry ? (
        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={handleUndoSave}>撤销本次保存</button>
          <span className="editor-hint">（30 秒内可撤销）</span>
        </div>
      ) : null}

      <div className="block" aria-label="投稿到精选池">
        <p className="block-title">投稿到精选池（可选）</p>
        <p className="block-note">你可以选择分享这张脸。未投稿时，记录仍然只属于你。</p>
        <label className="consent-row">
          <input type="checkbox" checked={consentPublic} onChange={(event) => setConsentPublic(event.target.checked)} />
          <span>我同意将这条投稿用于公开展示。</span>
        </label>
        <label className="consent-row">
          <input type="checkbox" checked={consentTemplate} onChange={(event) => setConsentTemplate(event.target.checked)} />
          <span>我同意在入选后作为可选模板使用。</span>
        </label>
        <label className="consent-row">
          <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
          <span>匿名展示（隐藏作者名）。</span>
        </label>
        <input
          className="settings-input"
          type="text"
          placeholder="可选：给这张脸留一句分享语"
          value={shareCaption}
          maxLength={60}
          onChange={(event) => setShareCaption(event.target.value)}
        />
        <div className="settings-actions">
          <button
            type="button"
            className={`ghost-btn ${submitBusy ? 'is-loading' : ''} ${submitDone ? 'is-success' : ''}`}
            onClick={() => void handleSubmit()}
            disabled={submitBusy}
          >
            {submitBusy ? <><span className="btn-spinner" aria-hidden />上传中...</> : submitDone ? '已提交审核' : '上传到精选池'}
          </button>
        </div>
        {submitHint ? <p className="editor-hint">{submitHint}</p> : null}
      </div>
    </section>
  )
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  const m = String(next.getMonth() + 1).padStart(2, '0')
  return `${next.getFullYear()}-${m}`
}
