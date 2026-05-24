import { fireEvent, render, screen } from '@testing-library/react'
import { getDefaultPreset } from '../lib/presets'
import { TodayPage } from './TodayPage'

describe('TodayPage', () => {
  const auth = {
    configured: false,
    signedIn: false,
  }

  it('shows unified three-stroke draw hint when no entry exists', () => {
    render(
      <TodayPage
        dateKey="2026-05-24"
        maxDateKey="2026-05-24"
        dateLabel="2026 年 5 月 24 日"
        auth={auth}
        featuredTemplates={[]}
        onDateChange={() => {}}
        onSave={() => {}}
        onSubmitMood={async () => {}}
      />,
    )
    expect(screen.getByText('先自由画三笔（0/3）。画完后进入微调。')).toBeInTheDocument()
    expect(screen.getByText('同步状态：尚未保存')).toBeInTheDocument()
  })

  it('calls onSave when existing face is present', () => {
    const face = getDefaultPreset().face
    const onSave = vi.fn()
    render(
      <TodayPage
        dateKey="2026-05-24"
        maxDateKey="2026-05-24"
        dateLabel="2026 年 5 月 24 日"
        auth={auth}
        featuredTemplates={[]}
        onDateChange={() => {}}
        onSave={onSave}
        onSubmitMood={async () => {}}
        entry={{
          id: 'e1',
          date: '2026-05-24',
          face,
          note: '',
          createdAt: '2026-05-24T10:00:00.000Z',
          updatedAt: '2026-05-24T10:00:00.000Z',
          syncStatus: 'local',
        }}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('今天只是有点累。'), {
      target: { value: '今天慢慢来' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存今天的脸' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const [note, savedFace] = onSave.mock.calls[0]
    expect(note).toBe('今天慢慢来')
    expect(savedFace.mode).toBe('expressive')
    expect(screen.getByText('今天的脸已经收好了。')).toBeInTheDocument()
  })
})
