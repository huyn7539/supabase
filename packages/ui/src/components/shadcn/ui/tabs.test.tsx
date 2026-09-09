import { render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it } from 'vitest'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const UNDERLINED = { borderBottomWidth: '1px' }

const renderTabs = (style: React.CSSProperties = UNDERLINED) =>
  render(
    <Tabs defaultValue="one">
      <TabsList style={style}>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First</TabsContent>
      <TabsContent value="two">Second</TabsContent>
    </Tabs>
  )

describe('Tabs', () => {
  it('marks the list ready a frame after mount, not during it', () => {
    const { container } = renderTabs()
    const list = container.querySelector<HTMLElement>('[role="tablist"]')

    expect(list?.dataset.tabIndicatorReady).toBeUndefined()
  })

  it('renders the underline by default, and skips lists with no bottom border', async () => {
    const withTrack = renderTabs().container.querySelector<HTMLElement>('[role="tablist"]')
    expect(withTrack?.querySelector('[data-tab-indicator]')).not.toBeNull()

    const withoutTrack = renderTabs({
      borderBottomWidth: '0px',
    }).container.querySelector<HTMLElement>('[role="tablist"]')

    await waitFor(() => expect(withTrack?.dataset.tabIndicatorReady).toBe(''))
    expect(withoutTrack?.dataset.tabIndicatorReady).toBeUndefined()
  })

  it('hides the underline when no trigger is active', async () => {
    const { container, rerender } = render(
      <Tabs value="one">
        <TabsList style={UNDERLINED}>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First</TabsContent>
      </Tabs>
    )
    const list = container.querySelector<HTMLElement>('[role="tablist"]')
    await waitFor(() => expect(list?.dataset.tabIndicatorReady).toBe(''))

    rerender(
      <Tabs value="gone">
        <TabsList style={UNDERLINED}>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First</TabsContent>
      </Tabs>
    )

    await waitFor(() => expect(list?.dataset.tabIndicatorReady).toBeUndefined())
  })

  it('renders the first trigger as the first element in the list', () => {
    const { container } = renderTabs()

    expect(container.querySelector('[role="tablist"]')?.firstElementChild).toBe(
      screen.getByRole('tab', { name: 'One' })
    )
  })

  it('passes a caller ref through to the list element', () => {
    const ref = { current: null as HTMLDivElement | null }

    render(
      <Tabs defaultValue="one">
        <TabsList ref={ref} style={UNDERLINED}>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First</TabsContent>
      </Tabs>
    )

    expect(ref.current).toBe(screen.getByRole('tablist'))
  })
})
