import { useEffect, useRef, useState } from 'react'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import {
  EMAIL_SIGNIN_COOLDOWN_SECONDS,
  getEmailSignInCooldownSeconds,
  type AuthSummary,
  type SyncMeta,
  type SyncMode,
  type SyncSummary,
} from '../lib/cloudSync'
import type { StorageStats } from '../lib/storage'
import type { MoodSubmission } from '../types/curation'

type ImportResult = { added: number; skipped: number; errors: number }

type SettingsPageProps = {
  stats: StorageStats
  auth: AuthSummary
  syncMeta: SyncMeta
  canInstallPrompt: boolean
  isInstalled: boolean
  onInstallApp: () => Promise<boolean>
  onSignIn: (email: string) => Promise<void>
  onVerifyOtp: (email: string, token: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSync: (mode: SyncMode) => Promise<SyncSummary>
  onRefreshAuth: () => Promise<void>
  displayName: string | null
  onUpdateDisplayName: (name: string) => Promise<void>
  onExport: () => void
  onImport: (jsonString: string) => ImportResult
  onClearLocal: () => void
  mySubmissions: MoodSubmission[]
  reviewQueue: MoodSubmission[]
  onWithdrawSubmission: (submissionId: string) => Promise<void>
  onRejectSubmission: (submissionId: string, reviewComment?: string) => Promise<void>
  onFeatureSubmission: (submissionId: string) => Promise<void>
}

type ConfirmDialogState = {
  title: string; message: string; confirmLabel: string
  tone?: 'default' | 'warn'
  onConfirm: () => Promise<void> | void
}

type InputDialogState = {
  title: string; message?: string; placeholder?: string; defaultValue?: string
  confirmLabel: string; tone?: 'default' | 'warn'
  requireNonEmpty?: boolean; emptyError?: string
  onConfirm: (value: string) => Promise<void> | void
}

function statusLabel(s: MoodSubmission['status']): string {
  if (s === 'uploaded') return '待审核'
  if (s === 'approved') return '已通过'
  if (s === 'rejected') return '未入选'
  if (s === 'featured') return '已入选'
  return '已撤回'
}

function statusDot(s: MoodSubmission['status']): string {
  if (s === 'featured') return 'is-synced'
  if (s === 'rejected' || s === 'withdrawn') return 'is-local'
  return 'is-dirty'
}

export function SettingsPage(props: SettingsPageProps) {
  const {
    stats, auth, syncMeta, canInstallPrompt, isInstalled,
    onInstallApp, onSignIn, onVerifyOtp, onSignOut, onSync, onRefreshAuth,
    displayName, onUpdateDisplayName,
    onExport, onImport, onClearLocal,
    mySubmissions, reviewQueue,
    onWithdrawSubmission, onRejectSubmission, onFeatureSubmission,
  } = props

  const [email, setEmail] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [emailCooldown, setEmailCooldown] = useState(0)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null)
  const [dialogInput, setDialogInput] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [dialogBusy, setDialogBusy] = useState(false)
  const [showSubmissions, setShowSubmissions] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)

  useEffect(() => {
    setEmailCooldown(getEmailSignInCooldownSeconds())
    const t = window.setInterval(() => setEmailCooldown(getEmailSignInCooldownSeconds()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (inputDialog) { setDialogInput(inputDialog.defaultValue ?? ''); setDialogError('') }
    else { setDialogInput(''); setDialogError('') }
  }, [inputDialog])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3000)
  }

  const isBusy = busyAction !== null || dialogBusy

  // ── sync bar data ──

  const syncStatusBar = () => {
    const total = stats.total || 1
    const syncedPct = Math.round((stats.synced / total) * 100)
    const dirtyPct = Math.round((stats.dirty / total) * 100)
    const localPct = 100 - syncedPct - dirtyPct
    return (
      <div className="sync-bar">
        <div className="sync-bar-track">
          {syncedPct > 0 && <span className="sync-bar-seg synced" style={{ width: `${syncedPct}%` }} />}
          {dirtyPct > 0 && <span className="sync-bar-seg dirty" style={{ width: `${dirtyPct}%` }} />}
          {localPct > 0 && <span className="sync-bar-seg local" style={{ width: `${localPct}%` }} />}
        </div>
        <div className="sync-bar-legend">
          <span>已同步 {stats.synced}</span>
          <span>待同步 {stats.dirty}</span>
          <span>仅本地 {stats.localOnly}</span>
        </div>
      </div>
    )
  }

  // ── handlers ──

  const handleSignIn = async () => {
    const clean = email.trim()
    if (!clean) { showToast('请输入邮箱地址。'); return }
    if (!navigator.onLine) { showToast('离线状态，请连接网络。'); return }
    if (emailCooldown > 0) { showToast(`请 ${emailCooldown} 秒后再试。`); return }
    try {
      setBusyAction('signin')
      await onSignIn(clean)
      setEmailCooldown(EMAIL_SIGNIN_COOLDOWN_SECONDS)
      setOtpEmail(clean)
      setOtpToken('')
      showToast('验证码已发送，请检查邮箱。')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '登录请求失败。')
    } finally { setBusyAction(null) }
  }

  const handleVerifyOtp = async () => {
    if (otpToken.trim().length < 6) { showToast('请输入验证码。'); return }
    try {
      setOtpBusy(true)
      await onVerifyOtp(otpEmail, otpToken)
      setOtpEmail('')
      setOtpToken('')
      showToast('登录成功。')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '验证失败。')
    } finally { setOtpBusy(false) }
  }

  const handleSignOut = async () => {
    try { setBusyAction('signout'); await onSignOut(); showToast('已退出。') }
    catch (e) { showToast(e instanceof Error ? e.message : '退出失败。') }
    finally { setBusyAction(null) }
  }

  const performSync = async (mode: SyncMode) => {
    if (!navigator.onLine) { showToast('离线状态。'); return }
    try {
      setBusyAction('sync')
      const s = await onSync(mode)
      const label = s.mode === 'merge' ? '安全合并' : s.mode === 'push_local' ? '本地覆盖云端' : '云端覆盖本地'
      showToast(`${label}完成：上传 ${s.pushed}，读取 ${s.pulled}，结果 ${s.merged} 条。`)
    } catch (e) { showToast(e instanceof Error ? e.message : '同步失败。') }
    finally { setBusyAction(null) }
  }

  const handleSync = (mode: SyncMode) => {
    if (mode !== 'merge') {
      const title = mode === 'push_local' ? '本地覆盖云端' : '云端覆盖本地'
      const msg = mode === 'push_local' ? '用本地覆盖云端，云端多余记录删除。' : '用云端覆盖本地，本地未同步可能丢失。'
      setConfirmDialog({ title, message: msg, confirmLabel: '确认', tone: 'warn', onConfirm: () => performSync(mode) })
      return
    }
    void performSync(mode)
  }

  const handleRefresh = async () => {
    try { setBusyAction('refresh'); await onRefreshAuth(); showToast('已刷新。') }
    catch (e) { showToast(e instanceof Error ? e.message : '刷新失败。') }
    finally { setBusyAction(null) }
  }

  const handleExport = () => { onExport(); showToast('导出完成。') }

  const handleImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json'
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return
      const r = new FileReader()
      r.onload = () => {
        try { const res = onImport(r.result as string); showToast(`导入：新增 ${res.added}，跳过 ${res.skipped}${res.errors ? `，失败 ${res.errors}` : ''}`) }
        catch (e) { showToast(e instanceof Error ? e.message : '导入失败。') }
      }
      r.onerror = () => showToast('文件读取失败。')
      r.readAsText(f)
    }
    inp.click()
  }

  const handleClear = () => setConfirmDialog({
    title: '清空本地数据', message: '确定清空本设备所有记录？不可撤销。', confirmLabel: '确认清空', tone: 'warn',
    onConfirm: () => { onClearLocal(); showToast('已清空。') },
  })

  const handleInstall = async () => {
    if (!canInstallPrompt) { showToast('浏览器不支持。请在浏览器菜单中选择"添加到主屏幕"。'); return }
    try { setBusyAction('install'); const ok = await onInstallApp(); showToast(ok ? '安装已发起。' : '已取消。') }
    catch (e) { showToast(e instanceof Error ? e.message : '安装失败。') }
    finally { setBusyAction(null) }
  }

  const handleWithdraw = (id: string) => setConfirmDialog({
    title: '撤回投稿', message: '撤回后从精选下架。', confirmLabel: '确认', tone: 'warn',
    onConfirm: async () => { try { setBusyAction('withdraw'); await onWithdrawSubmission(id); showToast('已撤回。') } catch (e) { showToast(e instanceof Error ? e.message : '失败。') } finally { setBusyAction(null) } },
  })

  const openReject = (id: string) => setInputDialog({
    title: '驳回', defaultValue: '暂不入选，欢迎继续投稿。', placeholder: '反馈（可选）', confirmLabel: '驳回', tone: 'warn',
    onConfirm: async (v) => { try { setBusyAction('review'); await onRejectSubmission(id, v || undefined); showToast('已驳回。') } catch (e) { showToast(e instanceof Error ? e.message : '失败。') } finally { setBusyAction(null) } },
  })

  const openFeature = (id: string) => setConfirmDialog({
    title: '入选精选池', message: '确认将此作品放入精选池？入选后所有用户可见。', confirmLabel: '确认入选',
    onConfirm: async () => { try { setBusyAction('review'); await onFeatureSubmission(id); showToast('已入选。') } catch (e) { showToast(e instanceof Error ? e.message : '失败。') } finally { setBusyAction(null) } },
  })

  const closeDialogs = () => { if (!dialogBusy) { setConfirmDialog(null); setInputDialog(null); setDialogError('') } }

  const confirmDialogAction = async () => {
    if (!confirmDialog || dialogBusy) return
    try { setDialogBusy(true); await confirmDialog.onConfirm(); setConfirmDialog(null) }
    catch (e) { setDialogError(e instanceof Error ? e.message : '操作失败。') }
    finally { setDialogBusy(false) }
  }

  const inputDialogRef = useRef<InputDialogState | null>(null)

  useEffect(() => {
    inputDialogRef.current = inputDialog
  }, [inputDialog])

  const confirmInputAction = async () => {
    if (!inputDialog || dialogBusy) return
    const v = dialogInput.trim()
    if (inputDialog.requireNonEmpty && !v) { setDialogError(inputDialog.emptyError ?? '请填写。'); return }
    try {
      setDialogBusy(true)
      await inputDialog.onConfirm(v)
      // 如果 onConfirm 已经设置了新的对话框（如“入选模板”的第二步），不要清除
      if (!inputDialogRef.current || inputDialogRef.current === inputDialog) {
        setInputDialog(null)
      }
      setDialogError('')
    }
    catch (e) { setDialogError(e instanceof Error ? e.message : '操作失败。') }
    finally { setDialogBusy(false) }
  }

  const syncMetaText = syncMeta.lastSyncedAt
    ? `最近同步：${new Date(syncMeta.lastSyncedAt).toLocaleString('zh-CN', { hour12: false })}`
    : '尚未同步到云端'

  // ── render ──

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>设置</h2>
      </div>

      {toast && <p className="settings-toast">{toast}</p>}

      {/* 数据与同步 */}
      <div className="settings-card">
        <h3 className="settings-card-title">数据与同步</h3>

        {auth.configured ? (
          <>
            <p className="settings-auth-state">
              {auth.signedIn
                ? `已登录 · ${auth.email ?? ''} · ${auth.role === 'admin' ? '管理员' : '普通用户'}`
                : '未登录'}
            </p>

            {auth.signedIn && (
              <div className="settings-auth-signin" style={{ alignItems: 'center' }}>
                <span className="settings-note" style={{ whiteSpace: 'nowrap' }}>昵称</span>
                <input
                  className="settings-input"
                  type="text"
                  maxLength={20}
                  placeholder="设置昵称，展示在精选池"
                  defaultValue={displayName ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (displayName ?? '')) onUpdateDisplayName(v).catch(() => {})
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
              </div>
            )}

            <p className="settings-note">{syncMetaText}</p>

            {auth.signedIn ? (
              <>
                {syncStatusBar()}
                <div className="settings-actions">
                  <button type="button" className="ghost-btn" onClick={() => handleSync('merge')} disabled={isBusy}>安全合并</button>
                  <button type="button" className="ghost-btn warn" onClick={() => handleSync('push_local')} disabled={isBusy}>本地覆盖云端</button>
                  <button type="button" className="ghost-btn warn" onClick={() => handleSync('pull_cloud')} disabled={isBusy}>云端覆盖本地</button>
                </div>
                <p className="settings-note">
                  冲突策略：默认"安全合并"按更新时间保留最新记录；覆盖模式替换另一端数据。
                </p>
                <div className="settings-actions">
                  <button type="button" className="ghost-btn" onClick={handleSignOut} disabled={isBusy}>退出登录</button>
                  <button type="button" className="ghost-btn" onClick={handleRefresh} disabled={isBusy}>刷新状态</button>
                </div>
              </>
            ) : (
              <>
                <div className="settings-auth-signin">
                  <input className="settings-input" type="email" placeholder="邮箱以接收验证码" value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                  <button type="button" className="ghost-btn" onClick={handleSignIn}
                    disabled={isBusy || emailCooldown > 0}>
                    {emailCooldown > 0 ? `稍候 ${emailCooldown}s` : '发送验证码'}
                  </button>
                </div>

                {otpEmail && (
                  <div className="settings-auth-signin">
                    <input className="settings-input" type="text" inputMode="numeric" maxLength={8}
                      placeholder="输入验证码" value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp() }}
                      autoFocus />
                    <button type="button" className="ghost-btn" onClick={handleVerifyOtp}
                      disabled={otpBusy || otpToken.length < 6}>
                      {otpBusy ? '验证中...' : '验证'}
                    </button>
                  </div>
                )}
              </>
            )}

            {!auth.signedIn && (
              <p className="settings-note">
                邮件中包含验证码（也附带备用登录链接）。在当前浏览器输入验证码即可登录，无需跳转。
              </p>
            )}
          </>
        ) : (
          <p className="settings-note">未配置 Supabase。当前为本地模式，仍可完整记录和导出。</p>
        )}
      </div>

      {/* 备份与恢复 */}
      <div className="settings-card">
        <h3 className="settings-card-title">备份与恢复</h3>
        {!auth.signedIn && stats.total > 0 && (
          <p className="settings-note" style={{ color: '#8d5b2f' }}>
            记录仅保存在本设备。建议登录同步或定期导出。
          </p>
        )}
        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={handleExport}>导出数据</button>
          <button type="button" className="ghost-btn" onClick={handleImport}>导入数据</button>
          <button type="button" className="ghost-btn warn" onClick={handleClear}>清空本地</button>
        </div>
      </div>

      {/* 我的投稿（仅登录后） */}
      {auth.signedIn && (
        <div className="settings-card">
          <button type="button" className="settings-card-title settings-fold-toggle"
            onClick={() => setShowSubmissions((p) => !p)}>
            <span>我的投稿 · {mySubmissions.length} 条</span>
            <span className="fold-arrow">{showSubmissions ? '▾' : '▸'}</span>
          </button>
          {showSubmissions && (
            mySubmissions.length === 0 ? (
              <p className="settings-note">暂无投稿。去今日页勾选授权后上传。</p>
            ) : (
              <div className="submission-timeline">
                {mySubmissions.map((s) => (
                  <div key={s.id} className="submission-item">
                    <span className={`submission-dot ${statusDot(s.status)}`} />
                    <div className="submission-item-body">
                      <span className="submission-item-date">{s.entryDate}</span>
                      <span className={`sync-pill ${statusDot(s.status)}`}>{statusLabel(s.status)}</span>
                      {s.reviewComment && <span className="submission-item-comment">{s.reviewComment}</span>}
                    </div>
                    <MoodFaceSvg face={s.face} className="submission-thumb" />
                    {s.status !== 'withdrawn' && (
                      <button type="button" className="ghost-btn warn" style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                        disabled={isBusy} onClick={() => handleWithdraw(s.id)}>撤回</button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* 审核管理（仅管理员） */}
      {auth.signedIn && auth.role === 'admin' && (
        <div className="settings-card">
          <button type="button" className="settings-card-title settings-fold-toggle"
            onClick={() => setShowAdmin((p) => !p)}>
            <span>审核管理 · {reviewQueue.length} 条待处理</span>
            <span className="fold-arrow">{showAdmin ? '▾' : '▸'}</span>
          </button>
          {showAdmin && (
            reviewQueue.length === 0 ? (
              <p className="settings-note">当前无待处理投稿。</p>
            ) : (
              <div className="submission-timeline">
                {reviewQueue.map((s) => (
                  <div key={s.id} className="submission-item">
                    <span className={`submission-dot ${statusDot(s.status)}`} />
                    <div className="submission-item-body">
                      <span className="submission-item-date">
                        {s.entryDate} · {s.authorDisplayName || '未设昵称'} · {s.authorEmail || s.userId.slice(0, 8)}
                      </span>
                      <p className="settings-note" style={{ margin: 0 }}>{s.note || '无备注'}</p>
                    </div>
                    <MoodFaceSvg face={s.face} className="submission-thumb" />
                    <div className="settings-actions" style={{ gap: '0.3rem' }}>
                      <button type="button" className="mini-chip" disabled={isBusy} onClick={() => openReject(s.id)}>驳回</button>
                      <button type="button" className="mini-chip" disabled={isBusy} onClick={() => openFeature(s.id)}>入选</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* 关于 */}
      <div className="settings-card">
        <h3 className="settings-card-title">关于</h3>
        <p className="settings-note" style={{ textAlign: 'center', opacity: 0.6 }}>
          三笔心情 · vibecoding 成果 · 仅供娱乐<br />
          邮箱仅用于登录，不作其他用途
        </p>
        <div className="settings-actions" style={{ justifyContent: 'center' }}>
          <a className="ghost-btn" href="/privacy.html" target="_blank" rel="noreferrer">隐私政策</a>
          <a className="ghost-btn" href="/submission-license.html" target="_blank" rel="noreferrer">投稿授权</a>
          {canInstallPrompt && !isInstalled && (
            <button type="button" className="ghost-btn" onClick={handleInstall} disabled={isBusy}>安装到主屏幕</button>
          )}
          {isInstalled && <span className="settings-note">已安装到主屏幕</span>}
        </div>
        <p className="settings-note" style={{ textAlign: 'center', marginTop: '0.5rem', opacity: 0.5, fontSize: '0.78rem' }}>
          作者：走心旁白
        </p>
      </div>

      {/* 对话弹窗 */}
      {confirmDialog && (
        <div className="dialog-mask" role="dialog" aria-modal="true">
          <div className="dialog-card">
            <p className="dialog-title">{confirmDialog.title}</p>
            <p className="dialog-copy">{confirmDialog.message}</p>
            {dialogError && <p className="dialog-error">{dialogError}</p>}
            <div className="settings-actions">
              <button type="button" className="ghost-btn" onClick={closeDialogs} disabled={dialogBusy}>取消</button>
              <button type="button" className={`ghost-btn ${confirmDialog.tone === 'warn' ? 'warn' : ''}`}
                onClick={() => void confirmDialogAction()} disabled={dialogBusy}>
                {dialogBusy ? '处理中...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {inputDialog && (
        <div className="dialog-mask" role="dialog" aria-modal="true">
          <div className="dialog-card">
            <p className="dialog-title">{inputDialog.title}</p>
            {inputDialog.message && <p className="dialog-copy">{inputDialog.message}</p>}
            <input className="settings-input dialog-input" type="text" value={dialogInput}
              placeholder={inputDialog.placeholder} onChange={(e) => setDialogInput(e.target.value)} disabled={dialogBusy} />
            {dialogError && <p className="dialog-error">{dialogError}</p>}
            <div className="settings-actions">
              <button type="button" className="ghost-btn" onClick={closeDialogs} disabled={dialogBusy}>取消</button>
              <button type="button" className={`ghost-btn ${inputDialog.tone === 'warn' ? 'warn' : ''}`}
                onClick={() => void confirmInputAction()} disabled={dialogBusy}>
                {dialogBusy ? '处理中...' : inputDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
