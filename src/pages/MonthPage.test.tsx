import { fireEvent, render, screen } from '@testing-library/react'
import { getDefaultPreset } from '../lib/presets'
import { MonthPage } from './MonthPage'

describe('MonthPage', () => {
  const face = getDefaultPreset().face

  it('renders entries and shows selected day details', () => {
    render(
      <MonthPage
        monthKey="2026-05"
        monthLabel="2026 年 5 月"
        canGoNext={false}
        isCurrentMonth={true}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        onBackCurrentMonth={() => {}}
        entries={[
          {
            id: 'm1',
            date: '2026-05-08',
            face,
            note: '这天有点低气压',
            createdAt: '2026-05-08T08:00:00.000Z',
            updatedAt: '2026-05-08T08:00:00.000Z',
            syncStatus: 'local',
          },
        ]}
      />,
    )

    expect(screen.getByText('这天有点低气压')).toBeInTheDocument()
    expect(screen.getByText('同步状态：仅本地')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled()
  })

  it('triggers month navigation callbacks', () => {
    const onPrevMonth = vi.fn()
    const onNextMonth = vi.fn()
    const onBackCurrentMonth = vi.fn()
    render(
      <MonthPage
        monthKey="2026-04"
        monthLabel="2026 年 4 月"
        canGoNext={true}
        isCurrentMonth={false}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onBackCurrentMonth={onBackCurrentMonth}
        entries={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '上个月' }))
    fireEvent.click(screen.getByRole('button', { name: '下个月' }))
    fireEvent.click(screen.getByRole('button', { name: '回到本月' }))

    expect(onPrevMonth).toHaveBeenCalledTimes(1)
    expect(onNextMonth).toHaveBeenCalledTimes(1)
    expect(onBackCurrentMonth).toHaveBeenCalledTimes(1)
  })
})
