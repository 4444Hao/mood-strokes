import { useState } from 'react'
import type { AuthSummary, SyncMeta, SyncMode, SyncSummary } from '../lib/cloudSync'
import type { StorageStats } from '../lib/storage'

const SETTINGS = [
  '你的记录默认只保存在这台设备上。',
  '登录后，可以选择同步到云端。',
  '支持导出数据与清空本地数据。',
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
}: SettingsPageProps) {
  const [email, setEmail] = useState('')
  const [busyAction, setBusyAction] = useState<'signin' | 'sync' | 'signout' | 'refresh' | 'install' | null>(null)
  const [hint, setHint] = useState('')
  const syncMetaText = syncMeta.lastSyncedAt
    ? `最近同步：${new Date(syncMeta.lastSyncedAt).toLocaleString('zh-CN', { hour12: false })}（${syncMeta.lastMode === 'merge' ? '安全合并' : syncMeta.lastMode === 'push_local' ? '本地覆盖云端' : '云端覆盖本地'}）`
    : '最近同步：尚无记录'

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
    try {
      setBusyAction('signin')
      await onSignIn(clean)
      setHint('登录链接已发送到邮箱，请点击邮件中的链接完成登录。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录请求失败。'
      setHint(message)
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

  const handleSync = async (mode: SyncMode) => {
    if (mode === 'push_local') {
      const ok = window.confirm('将使用本地记录覆盖云端（云端多余记录会删除）。确定继续吗？')
      if (!ok) {
        return
      }
    }
    if (mode === 'pull_cloud') {
      const ok = window.confirm('将使用云端记录覆盖本地。未同步到云端的本地改动可能丢失。确定继续吗？')
      if (!ok) {
        return
      }
    }
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
    const ok = window.confirm('确定要清空这台设备上的所有记录吗？此操作不可撤销。')
    if (!ok) {
      return
    }
    onClearLocal()
    setHint('本地记录已清空。')
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
                  disabled={busyAction !== null}
                >
                  发送登录链接
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
      </div>

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

      <div className="settings-actions">
        <button type="button" className="ghost-btn" onClick={handleExport}>
          导出数据
        </button>
        <button type="button" className="ghost-btn warn" onClick={handleClear}>
          清空本地数据
        </button>
      </div>

      {hint ? <p className="saved-hint">{hint}</p> : null}
    </section>
  )
}
