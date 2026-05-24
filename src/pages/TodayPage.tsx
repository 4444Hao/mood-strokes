import { useEffect, useState } from 'react'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import { ThreeStrokeMoodEditor } from '../components/ThreeStrokeMoodEditor'
import type { AuthSummary } from '../lib/cloudSync'
import type { FeaturedTemplate, SubmitMoodPayload } from '../types/curation'
import type { MoodEntry, MoodFace } from '../types/mood'

type TodayPageProps = {
  dateKey: string
  maxDateKey: string
  dateLabel: string
  entry?: MoodEntry
  auth: AuthSummary
  featuredTemplates: FeaturedTemplate[]
  onDateChange: (dateKey: string) => void
  onSave: (note: string, face: MoodFace) => void
  onSubmitMood: (payload: SubmitMoodPayload) => Promise<void>
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
  auth,
  featuredTemplates,
  onDateChange,
  onSave,
  onSubmitMood,
}: TodayPageProps) {
  const [note, setNote] = useState('')
  const [face, setFace] = useState<MoodFace | undefined>(undefined)
  const [savedHint, setSavedHint] = useState('')
  const [consentPublic, setConsentPublic] = useState(false)
  const [consentTemplate, setConsentTemplate] = useState(false)
  const [shareCaption, setShareCaption] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitHint, setSubmitHint] = useState('')

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

  const handleSubmit = async () => {
    if (!face) {
      setSubmitHint('先画好今天的脸，再上传到精选池。')
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
      await onSubmitMood({
        entryDate: dateKey,
        face,
        note,
        shareCaption,
        consentPublic,
        consentTemplate,
      })
      setSubmitHint('投稿已提交。你可以在设置页查看审核状态。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '投稿失败，请稍后再试。'
      setSubmitHint(message)
    } finally {
      setSubmitBusy(false)
    }
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

      {featuredTemplates.length > 0 ? (
        <div className="block">
          <p className="block-title">从精选模板开始</p>
          <p className="block-note">如果今天想快一点开始，可以先选一张再继续微调。</p>
          <div className="template-grid">
            {featuredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="template-card"
                onClick={() => setFace(template.face)}
              >
                <MoodFaceSvg face={template.face} className="template-face" />
                <span className="template-title">{template.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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

      <div className="block" aria-label="投稿到精选池">
        <p className="block-title">投稿到精选池（可选）</p>
        <p className="block-note">你可以选择分享这张脸。未投稿时，记录仍然只属于你。</p>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consentPublic}
            onChange={(event) => setConsentPublic(event.target.checked)}
          />
          <span>我同意将这条投稿用于公开展示。</span>
        </label>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consentTemplate}
            onChange={(event) => setConsentTemplate(event.target.checked)}
          />
          <span>我同意在入选后作为可选模板使用。</span>
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
          <button type="button" className="ghost-btn" onClick={() => void handleSubmit()} disabled={submitBusy}>
            上传到精选池
          </button>
        </div>
        {submitHint ? <p className="editor-hint">{submitHint}</p> : null}
      </div>

      {savedHint ? <p className="saved-hint">{savedHint}</p> : null}
    </section>
  )
}
