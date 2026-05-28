import { useEffect, useState } from 'react'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import {
  EMAIL_SIGNIN_COOLDOWN_SECONDS,
  getAuthRedirectTarget,
  getEmailSignInCooldownSeconds,
  type AuthSummary,
  type SyncMeta,
  type SyncMode,
  type SyncSummary,
} from '../lib/cloudSync'
import type { StorageStats } from '../lib/storage'
import type { MoodSubmission } from '../types/curation'

const SETTINGS = [
  '你的记录默认只保存在这台设备上。',
  '登录后，可以选择同步到云端。',
  '投稿功能默认关闭，仅在你主动上传时生效。',
]

type SettingsPageProps = {
  stats: StorageStats
  auth: AuthSummary
  syncMeta: SyncMeta
  canInstallPrompt: boolean
  isInstalled: boolean
  onInstallApp: () => Promise<boolean>
  onSignIn: (email: string) => Promise<void>
  onSignOut: () => Promise<void>
  onSync: (mode: SyncMode) => Promise<SyncSummary>
  onRefreshAuth: () => Promise<void>
  onExport: () => void
  onClearLocal: () => void
  mySubmissions: MoodSubmission[]
  reviewQueue: MoodSubmission[]
  onWithdrawSubmission: (submissionId: string) => Promise<void>
  onApproveSubmission: (submissionId: string, reviewComment?: string) => Promise<void>
  onRejectSubmission: (submissionId: string, reviewComment?: string) => Promise<void>
  onFeatureSubmission: (submissionId: string, title: string, description?: string) => Promise<void>
}

type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel: string
  tone?: 'default' | 'warn'
  onConfirm: () => Promise<void> | void
}

type InputDialogState = {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel: string
  tone?: 'default' | 'warn'
  requireNonEmpty?: boolean
  emptyError?: string
  onConfirm: (value: string) => Promise<void> | void
}

function statusLabel(status: MoodSubmission['status']): string {
  if (status === 'uploaded') {
    return '待审核'
  }
  if (status === 'approved') {
    return '已通过'
  }
  if (status === 'rejected') {
    return '未入选'
  }
  if (status === 'featured') {
    return '已入选模板'
  }
  return '已撤回'
}

function statusClass(status: MoodSubmission['status']): string {
  if (status === 'featured') {
    return 'is-synced'
  }
  if (status === 'rejected') {
    return 'is-local'
  }
  if (status === 'uploaded') {
    return 'is-dirty'
  }
  return 'is-synced'
}

export function SettingsPage({
  stats,
  auth,
  syncMeta,
  canInstallPrompt,
  isInstalled,
  onInstallApp,
  onSignIn,
  onSignOut,
  onSync,
  onRefreshAuth,
  onExport,
  onClearLocal,
  mySubmissions,
  reviewQueue,
  onWithdrawSubmission,
  onApproveSubmission,
  onRejectSubmission,
  onFeatureSubmission,
}: SettingsPageProps) {
  const [email, setEmail] = useState('')
  const [busyAction, setBusyAction] = useState<
    'signin' | 'sync' | 'signout' | 'refresh' | 'install' | 'withdraw' | 'review' | null
  >(null)
  const [hint, setHint] = useState('')
  const [emailCooldown, setEmailCooldown] = useState(0)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null)
  const [dialogInput, setDialogInput] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [dialogBusy, setDialogBusy] = useState(false)
  const syncMetaText = syncMeta.lastSyncedAt
    ? `最近同步：${new Date(syncMeta.lastSyncedAt).toLocaleString('zh-CN', { hour12: false })}（${syncMeta.lastMode === 'merge' ? '安全合并' : syncMeta.lastMode === 'push_local' ? '本地覆盖云端' : '云端覆盖本地'}）`
    : '最近同步：尚无记录'
  const redirectTarget = getAuthRedirectTarget()

  useEffect(() => {
    setEmailCooldown(getEmailSignInCooldownSeconds())
    const timer = window.setInterval(() => {
      setEmailCooldown(getEmailSignInCooldownSeconds())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (inputDialog) {
      setDialogInput(inputDialog.defaultValue ?? '')
      setDialogError('')
      return
    }
    setDialogInput('')
    setDialogError('')
  }, [inputDialog])

  const openConfirmDialog = (config: ConfirmDialogState) => {
    if (busyAction !== null || dialogBusy) {
      return
    }
    setConfirmDialog(config)
  }

  const openInputDialog = (config: InputDialogState) => {
    if (busyAction !== null || dialogBusy) {
      return
    }
    setInputDialog(config)
  }

  const closeDialogs = () => {
    if (dialogBusy) {
      return
    }
    setConfirmDialog(null)
    setInputDialog(null)
    setDialogError('')
  }

  const confirmDialogAction = async () => {
    if (confirmDialog == null || dialogBusy) {
      return
    }
    try {
      setDialogBusy(true)
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请稍后再试。'
      setDialogError(message)
    } finally {
      setDialogBusy(false)
    }
  }

  const confirmInputAction = async () => {
    if (inputDialog == null || dialogBusy) {
      return
    }
    const value = dialogInput.trim()
    if (inputDialog.requireNonEmpty && !value) {
      setDialogError(inputDialog.emptyError ?? '请先填写内容。')
      return
    }
    try {
      setDialogBusy(true)
      await inputDialog.onConfirm(value)
      setInputDialog(null)
      setDialogError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请稍后再试。'
      setDialogError(message)
    } finally {
      setDialogBusy(false)
    }
  }

  const handleExport = () => {
    onExport()
    setHint('导出完成，文件已下载到本地。')
  }

  const handleInstall = async () => {
    if (!canInstallPrompt) {
      setHint('当前浏览器未提供安装弹窗。你可以在浏览器菜单中选择“添加到主屏幕”。')
      return
    }
    try {
      setBusyAction('install')
      const accepted = await onInstallApp()
      setHint(accepted ? '已发起安装，完成后可在主屏幕打开。' : '已取消安装。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '安装请求失败。'
      setHint(message)
    } finally {
      setBusyAction(null)
    }
  }

  const handleSignIn = async () => {
    const clean = email.trim()
    if (!clean) {
      setHint('请输入用于登录的邮箱地址。')
      return
    }
    if (emailCooldown > 0) {
      setHint(`刚发送过登录链接，请 ${emailCooldown} 秒后再试。`)
      return
    }
    try {
      setBusyAction('signin')
      await onSignIn(clean)
      setEmailCooldown(EMAIL_SIGNIN_COOLDOWN_SECONDS)
      setHint(
        `登录链接已发送。请检查收件箱和垃圾箱，并在本设备中打开邮件里的链接完成登录（回跳地址：${redirectTarget}）。`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录请求失败。'
      setHint(
        `${message} 若一直收不到邮件，请确认 Supabase URL Configuration 已包含当前站点域名，并稍后重试。`,
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleSignOut = async () => {
    try {
      setBusyAction('signout')
      await onSignOut()
      setHint('已退出云端账号。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '退出失败。'
      setHint(message)
    } finally {
      setBusyAction(null)
    }
  }

  const performSync = async (mode: SyncMode) => {
    try {
      setBusyAction('sync')
      const summary = await onSync(mode)
      const modeLabel =
        summary.mode === 'merge'
          ? '安全合并'
          : summary.mode === 'push_local'
            ? '本地覆盖云端'
            : '云端覆盖本地'
      setHint(
        `${modeLabel}完成：上传 ${summary.pushed} 条，云端读取 ${summary.pulled} 条，结果 ${summary.merged} 条。`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失败。'
      setHint(message)
    } finally {
      setBusyAction(null)
    }
  }

  const handleSync = (mode: SyncMode) => {
    if (mode === 'push_local') {
      openConfirmDialog({
        title: '本地覆盖云端',
        message: '将使用本地记录覆盖云端，云端多余记录会删除。确定继续吗？',
        confirmLabel: '继续覆盖',
        tone: 'warn',
        onConfirm: () => performSync(mode),
      })
      return
    }
    if (mode === 'pull_cloud') {
      openConfirmDialog({
        title: '云端覆盖本地',
        message: '将使用云端记录覆盖本地，未同步到云端的本地改动可能丢失。确定继续吗？',
        confirmLabel: '继续覆盖',
        tone: 'warn',
        onConfirm: () => performSync(mode),
      })
      return
    }
    void performSync(mode)
  }

  const handleRefreshAuth = async () => {
    try {
      setBusyAction('refresh')
      await onRefreshAuth()
      setHint('已刷新登录状态。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '刷新登录状态失败。'
      setHint(message)
    } finally {
      setBusyAction(null)
    }
  }

  const handleClear = () => {
    openConfirmDialog({
      title: '清空本地数据',
      message: '确定要清空这台设备上的所有记录吗？此操作不可撤销。',
      confirmLabel: '确认清空',
      tone: 'warn',
      onConfirm: () => {
        onClearLocal()
        setHint('本地记录已清空。')
      },
    })
  }

  const handleWithdraw = async (submissionId: string) => {
    openConfirmDialog({
      title: '撤回投稿',
      message: '确定撤回这条投稿吗？撤回后会从精选池下架。',
      confirmLabel: '确认撤回',
      tone: 'warn',
      onConfirm: async () => {
        try {
          setBusyAction('withdraw')
          await onWithdrawSubmission(submissionId)
          setHint('投稿已撤回。')
        } catch (error) {
          const message = error instanceof Error ? error.message : '撤回失败。'
          setHint(message)
          throw error
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleApprove = async (submissionId: string) => {
    openInputDialog({
      title: '通过审核',
      message: '可选：给用户留一句通过理由',
      defaultValue: '这条心情很有细节，已通过审核。',
      placeholder: '输入审核反馈（可选）',
      confirmLabel: '确认通过',
      onConfirm: async (value) => {
        try {
          setBusyAction('review')
          await onApproveSubmission(submissionId, value || undefined)
          setHint('已标记为通过。')
        } catch (error) {
          const message = error instanceof Error ? error.message : '审核失败。'
          setHint(message)
          throw error
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleReject = async (submissionId: string) => {
    openInputDialog({
      title: '驳回投稿',
      message: '可选：给用户留一句鼓励反馈',
      defaultValue: '暂不入选精选，欢迎继续投稿。',
      placeholder: '输入审核反馈（可选）',
      confirmLabel: '确认驳回',
      tone: 'warn',
      onConfirm: async (value) => {
        try {
          setBusyAction('review')
          await onRejectSubmission(submissionId, value || undefined)
          setHint('已标记为未入选。')
        } catch (error) {
          const message = error instanceof Error ? error.message : '审核失败。'
          setHint(message)
          throw error
        } finally {
          setBusyAction(null)
        }
      },
    })
  }

  const handleFeature = async (submissionId: string) => {
    openInputDialog({
      title: '入选模板',
      message: '请输入模板标题',
      defaultValue: '今日精选',
      placeholder: '模板标题（必填）',
      confirmLabel: '下一步',
      requireNonEmpty: true,
      emptyError: '模板标题不能为空。',
      onConfirm: async (title) => {
        openInputDialog({
          title: '入选模板',
          message: '可选：模板说明',
          defaultValue: '一张很克制、细腻的表情。',
          placeholder: '模板说明（可选）',
          confirmLabel: '确认入选',
          onConfirm: async (description) => {
            try {
              setBusyAction('review')
              await onFeatureSubmission(submissionId, title, description || undefined)
              setHint('已加入模板库。')
            } catch (error) {
              const message = error instanceof Error ? error.message : '入选模板失败。'
              setHint(message)
              throw error
            } finally {
              setBusyAction(null)
            }
          },
        })
      },
    })
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>设置</h2>
        <p>隐私与数据</p>
      </div>

      <div className="settings-auth" aria-label="云同步入口">
        <p className="settings-stats-title">登录与同步</p>
        <p className="settings-auth-state">{syncMetaText}</p>
        {auth.configured ? (
          <>
            <p className="settings-auth-state">
              状态：
              {auth.signedIn ? `已登录（${auth.email ?? '未知邮箱'}）` : '未登录'}
              {auth.signedIn ? ` · 权限：${auth.role === 'admin' ? '管理员' : '普通用户'}` : ''}
            </p>
            {!auth.signedIn ? (
              <div className="settings-auth-signin">
                <input
                  className="settings-input"
                  type="email"
                  placeholder="输入邮箱以接收登录链接"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={handleSignIn}
                  disabled={busyAction !== null || emailCooldown > 0}
                >
                  {emailCooldown > 0 ? `稍后重试（${emailCooldown}s）` : '发送登录链接'}
                </button>
              </div>
            ) : (
              <div className="settings-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void handleSync('merge')}
                  disabled={busyAction !== null}
                >
                  安全合并同步
                </button>
                <button
                  type="button"
                  className="ghost-btn warn"
                  onClick={() => void handleSync('push_local')}
                  disabled={busyAction !== null}
                >
                  本地覆盖云端
                </button>
                <button
                  type="button"
                  className="ghost-btn warn"
                  onClick={() => void handleSync('pull_cloud')}
                  disabled={busyAction !== null}
                >
                  云端覆盖本地
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={handleSignOut}
                  disabled={busyAction !== null}
                >
                  退出登录
                </button>
              </div>
            )}
            <button
              type="button"
              className="ghost-btn"
              onClick={handleRefreshAuth}
              disabled={busyAction !== null}
            >
              刷新登录状态
            </button>
          </>
        ) : (
          <p className="settings-auth-state settings-note">
            未配置 Supabase 环境变量。当前为本地模式，仍可完整记录和导出。
          </p>
        )}
        <p className="settings-note">
          冲突策略说明：默认使用“安全合并”，按更新时间保留最新记录；覆盖模式会替换另一端数据。
        </p>
        {!auth.signedIn ? (
          <p className="settings-note">
            登录排查：回跳地址当前为 {redirectTarget}。请在 Supabase 的 Authentication URL Configuration
            中设置 Site URL 与 Redirect URLs 覆盖该地址。
          </p>
        ) : null}
      </div>

      {auth.signedIn ? (
        <div className="settings-install" aria-label="我的投稿">
          <p className="settings-stats-title">我的投稿</p>
          {mySubmissions.length === 0 ? (
            <p className="settings-note">你还没有投稿。去今日页勾选授权后即可上传。</p>
          ) : (
            <div className="submission-list">
              {mySubmissions.map((submission) => (
                <article key={submission.id} className="submission-card">
                  <MoodFaceSvg face={submission.face} className="submission-face" />
                  <div className="submission-copy">
                    <p className="submission-title">{submission.entryDate}</p>
                    <p className={`sync-pill ${statusClass(submission.status)}`}>状态：{statusLabel(submission.status)}</p>
                    {submission.reviewComment ? <p className="settings-note">反馈：{submission.reviewComment}</p> : null}
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="ghost-btn warn"
                        disabled={busyAction !== null || submission.status === 'withdrawn'}
                        onClick={() => void handleWithdraw(submission.id)}
                      >
                        {submission.status === 'withdrawn' ? '已撤回' : '撤回投稿'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {auth.signedIn && auth.role === 'admin' ? (
        <div className="settings-install" aria-label="审核队列">
          <p className="settings-stats-title">后台精选审核</p>
          <p className="settings-note">待审核状态会集中在这里，你可以通过、驳回或直接入选模板。</p>
          {reviewQueue.length === 0 ? (
            <p className="settings-note">当前没有待处理投稿。</p>
          ) : (
            <div className="submission-list">
              {reviewQueue.map((submission) => (
                <article key={submission.id} className="submission-card">
                  <MoodFaceSvg face={submission.face} className="submission-face" />
                  <div className="submission-copy">
                    <p className="submission-title">{submission.entryDate} · 用户 {submission.userId.slice(0, 8)}</p>
                    <p className={`sync-pill ${statusClass(submission.status)}`}>状态：{statusLabel(submission.status)}</p>
                    <p className="settings-note">备注：{submission.note || '无备注'}</p>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busyAction !== null}
                        onClick={() => void handleApprove(submission.id)}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        className="ghost-btn warn"
                        disabled={busyAction !== null}
                        onClick={() => void handleReject(submission.id)}
                      >
                        驳回
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busyAction !== null}
                        onClick={() => void handleFeature(submission.id)}
                      >
                        入选模板
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="settings-install" aria-label="安装应用">
        <p className="settings-stats-title">安装到设备</p>
        <p className="settings-auth-state">
          状态：{isInstalled ? '已安装' : canInstallPrompt ? '可安装' : '请通过浏览器菜单安装'}
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={handleInstall}
            disabled={busyAction !== null || isInstalled}
          >
            安装到主屏幕
          </button>
        </div>
        <p className="settings-note">安装后可像原生 App 一样从桌面打开，并支持离线启动。</p>
      </div>

      <div className="settings-stats" aria-label="本地数据统计">
        <p className="settings-stats-title">本地记录概览</p>
        <p>总记录：{stats.total}</p>
        <p>默认三笔：{stats.parametric}</p>
        <p>自由手绘：{stats.freehand}</p>
        <p>三笔微调：{stats.expressive}</p>
        <p>有备注：{stats.withNote}</p>
        <p>仅本地：{stats.localOnly}</p>
        <p>待同步：{stats.dirty}</p>
        <p>已同步：{stats.synced}</p>
      </div>

      <ul className="settings-list">
        {SETTINGS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="settings-install" aria-label="隐私与授权说明">
        <p className="settings-stats-title">隐私与授权说明</p>
        <p className="settings-note">
          登录与投稿前，请先阅读隐私政策与投稿授权说明。匿名投稿仅对前台展示匿名，平台管理员仍可看到账号标识用于审核与风控。
        </p>
        <div className="settings-actions">
          <a className="ghost-btn" href="/privacy.html" target="_blank" rel="noreferrer">
            隐私政策
          </a>
          <a className="ghost-btn" href="/submission-license.html" target="_blank" rel="noreferrer">
            投稿授权说明
          </a>
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="ghost-btn" onClick={handleExport}>
          导出数据
        </button>
        <button type="button" className="ghost-btn warn" onClick={handleClear}>
          清空本地数据
        </button>
      </div>

      {confirmDialog ? (
        <div className="dialog-mask" role="dialog" aria-modal="true" aria-label={confirmDialog.title}>
          <div className="dialog-card">
            <p className="dialog-title">{confirmDialog.title}</p>
            <p className="dialog-copy">{confirmDialog.message}</p>
            {dialogError ? <p className="dialog-error">{dialogError}</p> : null}
            <div className="settings-actions">
              <button type="button" className="ghost-btn" onClick={closeDialogs} disabled={dialogBusy}>
                取消
              </button>
              <button
                type="button"
                className={`ghost-btn ${confirmDialog.tone === 'warn' ? 'warn' : ''}`}
                onClick={() => void confirmDialogAction()}
                disabled={dialogBusy}
              >
                {dialogBusy ? '处理中...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inputDialog ? (
        <div className="dialog-mask" role="dialog" aria-modal="true" aria-label={inputDialog.title}>
          <div className="dialog-card">
            <p className="dialog-title">{inputDialog.title}</p>
            {inputDialog.message ? <p className="dialog-copy">{inputDialog.message}</p> : null}
            <input
              className="settings-input dialog-input"
              type="text"
              value={dialogInput}
              placeholder={inputDialog.placeholder}
              onChange={(event) => setDialogInput(event.target.value)}
              disabled={dialogBusy}
            />
            {dialogError ? <p className="dialog-error">{dialogError}</p> : null}
            <div className="settings-actions">
              <button type="button" className="ghost-btn" onClick={closeDialogs} disabled={dialogBusy}>
                取消
              </button>
              <button
                type="button"
                className={`ghost-btn ${inputDialog.tone === 'warn' ? 'warn' : ''}`}
                onClick={() => void confirmInputAction()}
                disabled={dialogBusy}
              >
                {dialogBusy ? '处理中...' : inputDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hint ? <p className="saved-hint">{hint}</p> : null}
    </section>
  )
}
