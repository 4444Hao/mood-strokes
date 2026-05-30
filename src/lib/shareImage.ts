import QRCode from 'qrcode'

const W = 1080
const H = 1440
const M = 80
const BG = '#f7f1e7'
const INK = '#2f2218'
const SOFT = '#6b5748'

const FONT = '"Noto Serif SC","Source Han Serif SC","STKaiti","KaiTi",serif'

function line(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = '#d8c8b2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(W - M, y)
  ctx.stroke()
}

export async function generateShareImage(
  faceSvgElement: SVGSVGElement,
  note: string,
  authorLabel: string,
  dateLabel: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = INK
  ctx.font = `700 56px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('三笔心情', W / 2, 100)
  ctx.fillStyle = SOFT
  ctx.font = `28px ${FONT}`
  ctx.fillText('三笔极简，情绪万千。', W / 2, 146)
  line(ctx, 180)

  // Face
  const faceSize = 600
  const faceImg = await svgToImage(faceSvgElement, faceSize)
  ctx.drawImage(faceImg, (W - faceSize) / 2, 230, faceSize, faceSize)
  line(ctx, 860)

  // Note
  ctx.fillStyle = INK
  ctx.font = `34px ${FONT}`
  ctx.textAlign = 'center'
  const noteText = note || '今天的心情，都在三笔之间。'
  const lines = wrapText(ctx, `"${noteText}"`, W - M * 2)
  const noteBaseY = 920
  lines.forEach((l, i) => ctx.fillText(l, W / 2, noteBaseY + i * 50))

  // Bottom row
  const qrSize = 160
  const qrX = W - M - qrSize
  const rowCenterY = H - M - 40

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, 'https://mood-strokes.pages.dev', {
    width: qrSize, margin: 1,
    color: { dark: INK, light: BG },
  })
  ctx.drawImage(qrCanvas, qrX, rowCenterY - qrSize / 2, qrSize, qrSize)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `28px ${FONT}`
  ctx.fillStyle = SOFT
  ctx.fillText(`${dateLabel}  ·  ${authorLabel}`, M, rowCenterY)

  line(ctx, rowCenterY - qrSize / 2 - 36)

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
