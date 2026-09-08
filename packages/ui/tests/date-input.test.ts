import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Calendar } from '../src/ui/Calendar'

describe('DateInput yearNavigation default max', () => {
  it('year dropdown includes the tenth year ahead when max is omitted', () => {
    const farYear = new Date().getFullYear() + 10
    const html = renderToStaticMarkup(
      createElement(Calendar, {
        yearNavigation: true,
        toDate: new Date(farYear, 11, 31),
        value: null,
      }),
    )

    expect(html).toContain(`>${farYear}<`)
  })
})
