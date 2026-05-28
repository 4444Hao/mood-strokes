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

  it('shows canvas and save button on load', () => {
    render(<TodayPage {...baseProps} />)
    expect(screen.getByText('保存')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('📅 月历')).toBeInTheDocument()
  })

  it('calls onSave when entry exists and user covers', () => {
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

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '今天慢慢来' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    fireEvent.click(screen.getByRole('button', { name: '覆盖' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toBe('今天慢慢来')
    expect(onSave.mock.calls[0][1].mode).toBe('expressive')
    expect(screen.getByText('已覆盖。')).toBeInTheDocument()
  })

  it('shows back-to-today chip when on a past date', () => {
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
  })

  it('does not show back-to-today on today', () => {
    render(<TodayPage {...baseProps} />)
    expect(screen.queryByRole('button', { name: '回到今天' })).not.toBeInTheDocument()
  })

  it('toggles fold sections', () => {
    render(<TodayPage {...baseProps} />)
    fireEvent.click(screen.getByText('📅 月历'))
    expect(screen.getByText('2026 年 5 月')).toBeInTheDocument()
    fireEvent.click(screen.getByText('📅 月历'))
    expect(screen.queryByText('2026 年 5 月')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('✉ 投稿'))
    expect(screen.getByText('上传到精选池')).toBeInTheDocument()
  })
})
