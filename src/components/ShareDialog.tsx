import { useEffect, useState } from 'react'

type ShareDialogProps = {
  blob: Blob | null
  onClose: () => void
}

export function ShareDialog({ blob, onClose }: ShareDialogProps) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (blob) {
      const u = URL.createObjectURL(blob)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }
    setUrl('')
    return undefined
  }, [blob])

  if (!blob || !url) return null

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = '三笔心情.png'
    a.click()
  }

  const handleShare = async () => {
    setBusy(true)
    try {
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], '三笔心情.png', { type: 'image/png' })] })) {
        await navigator.share({
          title: '三笔心情',
          text: '用三笔记录今天的心情',
          files: [new File([blob], '三笔心情.png', { type: 'image/png' })],
        })
      } else {
        handleDownload()
      }
    } catch {
      // user cancelled or not supported — fallback to download
      handleDownload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-mask" role="dialog" aria-modal="true" aria-label="分享预览">
      <div className="dialog-card" style={{ width: 'min(420px, 90vw)' }}>
        <p className="dialog-title">分享这张表情</p>
        <img src={url} alt="分享预览" style={{ width: '100%', borderRadius: '12px' }} />
        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={handleDownload}>保存图片</button>
          <button type="button" className="primary-btn" onClick={handleShare} disabled={busy}>
            {busy ? '处理中...' : '分享'}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
