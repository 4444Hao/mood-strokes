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

  it('shows empty-day poetic copy in month detail and hanger view', () => {
    render(
      <MonthPage
        monthKey="2026-05"
        monthLabel="2026 年 5 月"
        canGoNext={false}
        isCurrentMonth={true}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        onBackCurrentMonth={() => {}}
        entries={[]}
      />,
    )

    const day1 = screen.getByRole('button', { name: '1号无记录' })
    fireEvent.click(day1)

    const emptyQuotes = [
      '空白的一天。',
      '有些日子，不需要定义。',
      '还没来得及记录呢。',
      '那天的心情，藏起来了。',
      '点击这里，补上三笔心情。',
      '这一天，没有留下笔画。',
    ]
    expect(screen.getByText((content) => emptyQuotes.includes(content))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '挂历翻页' }))
    expect(screen.getByText('可以切到今日页，为这一天补上三笔心情。')).toBeInTheDocument()
  })

  it('supports hanger day flip navigation', () => {
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
            id: 'm2',
            date: '2026-05-03',
            face,
            note: '第三天',
            createdAt: '2026-05-03T08:00:00.000Z',
            updatedAt: '2026-05-03T08:00:00.000Z',
            syncStatus: 'synced',
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: '挂历翻页' }))
    expect(screen.getByText('第三天')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '上一天' }))
    expect(screen.queryByText('第三天')).not.toBeInTheDocument()
  })
})
