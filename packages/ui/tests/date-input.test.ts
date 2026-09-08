import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calendarSpy } = vi.hoisted(() => ({
  calendarSpy: vi.fn(),
}))

vi.mock('#ds/ui/Calendar', () => ({
  Calendar: (props: Record<string, unknown>) => {
    calendarSpy(props)
    return null
  },
}))

vi.mock('#ds/ui/Popover', () => {
  function Popover({ children }: { children: ReactNode }) {
    return createElement('div', null, children)
  }

  Popover.Trigger = ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) =>
    createElement('button', rest, children)

  Popover.Content = ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) =>
    createElement('div', rest, children)

  return { Popover }
})

import { DateInput } from '../src/ui/DateInput'

function renderDateInput(props: Record<string, unknown> = {}) {
  renderToStaticMarkup(
    createElement(DateInput, {
      'data-testid': 'date-input',
      ...props,
    }),
  )
}

function lastCalendarProps(): Record<string, unknown> {
  const calls = calendarSpy.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1]![0] as Record<string, unknown>
}

describe('DateInput yearNavigation default max', () => {
  beforeEach(() => {
    calendarSpy.mockClear()
  })

  it('passes Dec 31 of the tenth year ahead when max is omitted and yearNavigation is true', () => {
    const farYear = new Date().getFullYear() + 10

    renderDateInput({ yearNavigation: true })

    expect(lastCalendarProps().toDate).toEqual(new Date(farYear, 11, 31))
  })

  it('prefers an explicit max over the yearNavigation default', () => {
    renderDateInput({ yearNavigation: true, max: '2020-06-15' })

    expect(lastCalendarProps().toDate).toEqual(new Date(2020, 5, 15))
  })

  it('does not pass toDate when yearNavigation is false', () => {
    renderDateInput({ yearNavigation: false })

    expect(lastCalendarProps().toDate).toBeUndefined()
  })

  it('does not pass toDate when yearNavigation is omitted', () => {
    renderDateInput()

    expect(lastCalendarProps().toDate).toBeUndefined()
  })
})
