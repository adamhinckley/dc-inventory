import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rootPropsSpy } = vi.hoisted(() => ({
  rootPropsSpy: vi.fn(),
}))

vi.mock('@base-ui-components/react/select', () => {
  function Root(props: { children?: ReactNode; value?: unknown }) {
    rootPropsSpy(props)
    return createElement('div', { 'data-testid': 'select-root' }, props.children)
  }

  function Trigger({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) {
    return createElement('button', rest, children)
  }

  const Value = ({ children }: { children?: ReactNode }) => createElement('span', null, children)
  const Icon = ({ children }: { children?: ReactNode }) => createElement('span', null, children)
  const Portal = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const Positioner = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const Popup = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const List = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const Item = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const ItemText = ({ children }: { children?: ReactNode }) => createElement('span', null, children)
  const ItemIndicator = ({ children }: { children?: ReactNode }) =>
    createElement('span', null, children)

  return {
    Select: {
      Root,
      Trigger,
      Value,
      Icon,
      Portal,
      Positioner,
      Popup,
      List,
      Item,
      ItemText,
      ItemIndicator,
    },
  }
})

import { Select } from '../src/ui/Select'

describe('Select controlled empty value', () => {
  beforeEach(() => {
    rootPropsSpy.mockClear()
  })

  it('passes null through to Base UI Root so Apply Credit stays controlled when empty', () => {
    renderToStaticMarkup(
      createElement(Select, {
        options: [{ value: 'pay-1', label: 'Payment 1' }],
        value: null,
        onChange: () => undefined,
        placeholder: 'Choose a payment',
        'data-testid': 'apply-credit-payment',
      }),
    )

    expect(rootPropsSpy).toHaveBeenCalledOnce()
    const rootProps = rootPropsSpy.mock.calls[0]![0] as { value: unknown }
    expect(rootProps.value).toBe(null)
  })

  it('passes a selected value through without coercing to undefined', () => {
    renderToStaticMarkup(
      createElement(Select, {
        options: [{ value: 'pay-1', label: 'Payment 1' }],
        value: 'pay-1',
        onChange: () => undefined,
        placeholder: 'Choose a payment',
      }),
    )

    const rootProps = rootPropsSpy.mock.calls[0]![0] as { value: unknown }
    expect(rootProps.value).toBe('pay-1')
  })
})
