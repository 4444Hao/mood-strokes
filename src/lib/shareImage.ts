import QRCode from 'qrcode'

const W = 1080
const M = 80
const BG = '#f7f1e7'
const INK = '#2f2218'
const SOFT = '#6b5748'

const FONT = '"Noto Serif SC","Source Han Serif SC","STKaiti","KaiTi",serif'

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

  // Title
  ctx.fillStyle = INK
  ctx.font = `700 56px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('三笔心情', W / 2, 90)

  // Subtitle
  ctx.fillStyle = SOFT
  ctx.font = `28px ${FONT}`
  ctx.fillText('三笔极简，情绪万千。', W / 2, 136)

  // Separator
  ctx.strokeStyle = '#d8c8b2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, 168)
  ctx.lineTo(W - M, 168)
  ctx.stroke()

  // Face SVG → Image
  const faceSize = 520
  const faceImg = await svgToImage(faceSvgElement, faceSize)
  const faceX = (W - faceSize) / 2
  const faceY = 210
  ctx.drawImage(faceImg, faceX, faceY, faceSize, faceSize)

  // Separator
  ctx.beginPath()
  ctx.moveTo(M, 760)
  ctx.lineTo(W - M, 760)
  ctx.stroke()

  // Note
  ctx.fillStyle = INK
  ctx.font = `34px ${FONT}`
  const noteText = note || '今天的心情，都在三笔之间。'
  const maxWidth = W - M * 2
  const lines = wrapText(ctx, `"${noteText}"`, maxWidth)
  const noteY = 810
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, noteY + i * 48)
  })

  // Bottom row: QR + date/author on same line
  const qrSize = 172
  const qrX = W - M - qrSize
  const rowY = W - M - 10

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, 'https://mood-strokes.pages.dev', {
    width: qrSize,
    margin: 1,
    color: { dark: '#2f2218', light: '#f7f1e7' },
  })
  const qrTopY = rowY - qrSize
  ctx.drawImage(qrCanvas, qrX, qrTopY, qrSize, qrSize)

  // Date + Author — same row as QR, left-aligned, vertically centered with QR
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `26px ${FONT}`
  ctx.fillStyle = SOFT
  ctx.fillText(`${dateLabel}  ·  ${authorLabel}`, M, qrTopY + qrSize / 2)

  // Separator above bottom row
  ctx.beginPath()
  ctx.moveTo(M, rowY - qrSize - 20)
  ctx.lineTo(W - M, rowY - qrSize - 20)
  ctx.stroke()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob 失败。'))
    }, 'image/png')
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const result: string[] = []
  let remain = text
  while (remain.length > 0) {
    let low = 0
    let high = remain.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (ctx.measureText(remain.slice(0, mid)).width <= maxWidth) low = mid
      else high = mid - 1
    }
    if (low === 0) { result.push(remain); break }
    result.push(remain.slice(0, low))
    remain = remain.slice(low)
  }
  return result.slice(0, 3)
}

async function svgToImage(svgEl: SVGSVGElement, size: number): Promise<HTMLImageElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  const svgString = new XMLSerializer().serializeToString(clone)
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG 转图片失败。'))
    img.src = dataUrl
  })
}
