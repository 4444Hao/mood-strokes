import { MoodFaceSvg } from '../components/MoodFaceSvg'
import type { FeaturedTemplate } from '../types/curation'

type FeaturedPageProps = {
  templates: FeaturedTemplate[]
}

function authorLabel(template: FeaturedTemplate): string {
  if (template.isAnonymous) {
    return '匿名'
  }
  if (template.authorName && template.authorName.trim()) {
    return template.authorName.trim()
  }
  return `用户 ${template.createdBy.slice(0, 8)}`
}

export function FeaturedPage({ templates }: FeaturedPageProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>精选池</h2>
        <p>画与一句话，被轻轻放在这里。</p>
      </div>

      {templates.length === 0 ? (
        <section className="block">
          <p className="block-title">暂时还没有精选作品</p>
          <p className="block-note">当有作品入选后，会在这里展示表情、描述和原作者名字。</p>
        </section>
      ) : (
        <div className="featured-grid" aria-label="精选作品列表">
          {templates.map((template) => (
            <article key={template.id} className="featured-card">
              <MoodFaceSvg face={template.face} className="featured-face" />
              <div className="featured-copy">
                <p className="featured-title">{template.title}</p>
                <p className="featured-note">{template.note || template.description || '这张脸没有留下文字。'}</p>
                <p className="featured-author">by {authorLabel(template)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
