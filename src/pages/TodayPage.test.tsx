import { fireEvent, render, screen } from '@testing-library/react'
import { getDefaultPreset } from '../lib/presets'
import { TodayPage } from './TodayPage'

describe('TodayPage', () => {
  const baseProps = {
    dateKey: '2026-05-24',
    todayKey: '2026-05-24',
    monthKey: '2026-05',
    dateLabel: '2026 年 5 月 24 日',
    auth: { configured: false, signedIn: false },
    featuredTemplates: [] as never[],
    monthEntries: [],
    onDateChange: () => {},
    onMonthChange: () => {},
    onSave: () => {},
    onSubmitMood: async () => {},
  }

  it('shows editor and heatmap when no entry exists', () => {
    render(<TodayPage {...baseProps} />)
    expect(screen.getByText('三笔心情')).toBeInTheDocument()
    expect(screen.getByText('2026 年 5 月')).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('calls onSave when entry is present and user saves', () => {
    const face = getDefaultPreset().face
    const onSave = vi.fn()
    render(
      <TodayPage
        {...baseProps}
        onSave={onSave}
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

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '今天慢慢来' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    fireEvent.click(screen.getByRole('button', { name: '覆盖保存' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const [note, savedFace] = onSave.mock.calls[0]
    expect(note).toBe('今天慢慢来')
    expect(savedFace.mode).toBe('expressive')
    expect(screen.getByText('已覆盖这天。')).toBeInTheDocument()
  })

  it('shows "回到今天" button when viewing a different date', () => {
    render(
      <TodayPage
        {...baseProps}
        dateKey="2026-05-20"
        todayKey="2026-05-24"
        entry={{
          id: 'e2',
          date: '2026-05-20',
          face: getDefaultPreset().face,
          note: '之前的一天',
          createdAt: '2026-05-20T08:00:00.000Z',
          updatedAt: '2026-05-20T08:00:00.000Z',
          syncStatus: 'local',
        }}
      />,
    )
    expect(screen.getByRole('button', { name: '回到今天' })).toBeInTheDocument()
    const notes = screen.getAllByText('之前的一天')
    expect(notes.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show "回到今天" when viewing today', () => {
    render(<TodayPage {...baseProps} />)
    expect(screen.queryByRole('button', { name: '回到今天' })).not.toBeInTheDocument()
  })
})
