import { useCallback, useMemo, useState } from 'react'
import { MoodFaceSvg } from '../components/MoodFaceSvg'
import type { FeaturedTemplate } from '../types/curation'

const PAGE_SIZE = 2

type LayoutId = 'side-by-side' | 'big-left' | 'big-right' | 'diagonal'

const LAYOUTS: LayoutId[] = ['side-by-side', 'big-left', 'big-right', 'diagonal']

type FeaturedPageProps = {
  templates: FeaturedTemplate[]
}

function authorLabel(t: FeaturedTemplate): string {
  if (t.isAnonymous) return '匿名'
  if (t.authorName?.trim()) return t.authorName.trim()
  return `用户 ${t.createdBy.slice(0, 8)}`
}

function layoutForPage(pageIdx: number): LayoutId {
  return LAYOUTS[pageIdx % LAYOUTS.length]
}

export function FeaturedPage({ templates }: FeaturedPageProps) {
  const pages = useMemo(() => {
    const result: FeaturedTemplate[][] = []
    for (let i = 0; i < templates.length; i += PAGE_SIZE) {
      result.push(templates.slice(i, i + PAGE_SIZE))
    }
    return result
  }, [templates])

  const [pageIdx, setPageIdx] = useState(0)
  const [flipDir, setFlipDir] = useState<'left' | 'right' | null>(null)
  const [flipKey, setFlipKey] = useState(0)
  const totalPages = pages.length
  const page = pages[pageIdx] ?? []
  const layout = layoutForPage(pageIdx)

  const triggerFlip = useCallback((dir: 'left' | 'right') => {
    setFlipDir(dir)
    setFlipKey((k) => k + 1)
    window.setTimeout(() => setFlipDir(null), 320)
  }, [])

  const goTo = useCallback(
    (dir: 'prev' | 'next') => {
      if (dir === 'prev' && pageIdx > 0) {
        triggerFlip('left')
        setPageIdx((p) => p - 1)
      } else if (dir === 'next' && pageIdx < totalPages - 1) {
        triggerFlip('right')
        setPageIdx((p) => p + 1)
      }
    },
    [pageIdx, totalPages, triggerFlip],
  )

  const flipClass = flipDir ? `flip-${flipDir}` : ''

  if (templates.length === 0) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>精选池</h2>
          <p>画与一句话，被轻轻放在这里。</p>
        </div>
        <div className="block" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <p className="block-title">精选池是大家的情绪画册</p>
          <p className="block-note">每一条入选的作品，都会被轻轻放在这里。去今日页投稿，你的表情也可能出现在这里。</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>精选池</h2>
        <p>画与一句话，被轻轻放在这里。</p>
      </div>

      <div className="folio-book">
        <div className="folio-book-spine" aria-hidden />

        <article key={flipKey} className={`folio-leaf ${flipClass} folio-${layout}`}>
          <div className="folio-edge prev" onClick={() => goTo('prev')} aria-label="上一页" />
          <div className="folio-edge next" onClick={() => goTo('next')} aria-label="下一页" />

          {page.map((t, i) => (
            <div key={t.id} className={`folio-card folio-card-${i}`}>
              <div className="folio-tape" aria-hidden />
              <MoodFaceSvg face={t.face} className="folio-face" />
              <div className="folio-text">
                <p className="folio-title">{t.title}</p>
                <p className="folio-note">{t.note || t.description || ''}</p>
                <p className="folio-author">by {authorLabel(t)}</p>
              </div>
            </div>
          ))}
        </article>

        <div className="folio-foot">
          <button type="button" className="ghost-btn" onClick={() => goTo('prev')} disabled={pageIdx <= 0}>
            ◀
          </button>
          <span className="folio-page-num">第 {pageIdx + 1} / {totalPages} 页</span>
          <button type="button" className="ghost-btn" onClick={() => goTo('next')} disabled={pageIdx >= totalPages - 1}>
            ▶
          </button>
        </div>
      </div>
    </section>
  )
}
