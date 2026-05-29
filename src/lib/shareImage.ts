import QRCode from 'qrcode'

const W = 1080
const M = 60
const BG = '#f7f1e7'
const INK = '#2f2218'
const SOFT = '#6b5748'

const FONT_TITLE = '700 68px "STKaiti","KaiTi","Noto Serif SC",serif'
const FONT_BODY = '32px "Noto Serif SC","Source Han Serif SC",serif'
const FONT_SMALL = '26px "Noto Serif SC","Source Han Serif SC",serif'

export async function generateShareImage(
  faceSvgElement: SVGSVGElement,
  note: string,
  authorLabel: string,
  dateLabel: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = W
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, W)

  // Top line
  ctx.strokeStyle = '#d8c8b2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, 150)
  ctx.lineTo(W - M, 150)
  ctx.stroke()

  // Title
  ctx.fillStyle = INK
  ctx.font = FONT_TITLE
  ctx.textAlign = 'center'
  ctx.fillText('三笔心情 · Mood Strokes', W / 2, 110)

  // --- Face SVG → Image ---
  const faceImg = await svgToImage(faceSvgElement, 450)
  const faceX = (W - 450) / 2
  const faceY = 200
  ctx.drawImage(faceImg, faceX, faceY, 450, 450)

  // Separator
  ctx.strokeStyle = '#d8c8b2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, 700)
  ctx.lineTo(W - M, 700)
  ctx.stroke()

  // Note
  ctx.fillStyle = INK
  ctx.font = FONT_BODY
  ctx.textAlign = 'center'
  const noteText = note || '今天的心情，都在三笔之间。'
  ctx.fillText(`"${noteText}"`, W / 2, 750)

  // --- QR Code ---
  const qrSize = 160
  const qrX = W - M - qrSize
  const qrY = W - M - qrSize - 80
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, 'https://mood-strokes.pages.dev', {
    width: qrSize,
    margin: 1,
    color: { dark: '#2f2218', light: '#f7f1e7' },
  })
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

  ctx.fillStyle = SOFT
  ctx.font = FONT_SMALL
  ctx.textAlign = 'right'
  ctx.fillText('扫码体验三笔心情', qrX + qrSize / 2, qrY - 14)

  // Date + Author
  ctx.textAlign = 'left'
  ctx.font = FONT_SMALL
  ctx.fillStyle = SOFT
  ctx.fillText(`${dateLabel} · ${authorLabel}`, M, W - 50)

  // Bottom line
  ctx.strokeStyle = '#d8c8b2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, W - 100)
  ctx.lineTo(W - M, W - 100)
  ctx.stroke()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob 失败。'))
    }, 'image/png')
  })
}

async function svgToImage(svgEl: SVGSVGElement, size: number): Promise<HTMLImageElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG 转图片失败。'))
    img.src = dataUrl
  })
}
