import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

const wrappers = []

function mountSwitcher(workspaces) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useTeamsStore()
  store.workspaces = workspaces
  store.activeWorkspaceId = workspaces[0]?.id ?? null
  const wrapper = mount(WorkspaceSwitcher, {
    attachTo: document.body,
    global: { plugins: [pinia] },
  })
  wrappers.push(wrapper)
  return wrapper
}

const workspaces = [
  { id: 'workspace-1', name: 'WhistleIt', initials: 'WI', role: 'admin', isAdmin: true },
  { id: 'workspace-2', name: 'Design Studio', initials: 'DS', role: 'member', isAdmin: false },
]

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('WorkspaceSwitcher', () => {
  it('renders only the active tile and opens the flyout on hover after a short delay', async () => {
    vi.useFakeTimers()
    const wrapper = mountSwitcher(workspaces)
    const trigger = wrapper.get('.workspace-switcher__button')

    expect(wrapper.findAll('.workspace-switcher__button')).toHaveLength(1)
    expect(trigger.text()).toBe('WI')
    await trigger.trigger('mouseenter')
    vi.advanceTimersByTime(149)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).toBeNull()

    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')?.textContent).toContain('Design Studio')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('mouseleave')
    vi.advanceTimersByTime(199)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
  })

  it('keeps the flyout open while the pointer crosses the gap from the rail tile', async () => {
    vi.useFakeTimers()
    const wrapper = mountSwitcher(workspaces)
    const trigger = wrapper.get('.workspace-switcher__button')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({
      left: 19,
      right: 55,
      top: 100,
      bottom: 136,
      width: 36,
      height: 36,
    })

    await trigger.trigger('mouseenter')
    vi.advanceTimersByTime(150)
    await flushPromises()

    const menu = document.body.querySelector('.workspace-switcher__menu')
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      left: 83,
      right: 355,
      top: 100,
      bottom: 260,
      width: 272,
      height: 160,
    })
    window.dispatchEvent(new Event('resize'))
    await flushPromises()

    const bridge = document.body.querySelector('.workspace-switcher__hover-bridge')
    expect(bridge.style.left).toBe('55px')
    expect(bridge.style.width).toBe('28px')

    await trigger.trigger('mouseleave')
    await bridge.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()

    await bridge.dispatchEvent(new MouseEvent('mouseleave'))
    await menu.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()
  })

  it('opens with keyboard, moves through items with arrows, and selects a workspace', async () => {
    const wrapper = mountSwitcher(workspaces)
    const trigger = wrapper.get('.workspace-switcher__button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })

    const menuItems = document.body.querySelectorAll('[role="menuitem"]')
    expect(menuItems).toHaveLength(2)
    expect(document.activeElement).toBe(menuItems[0])
    menuItems[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(menuItems[1])

    menuItems[1].click()
    await flushPromises()
    expect(wrapper.emitted('select')).toEqual([['workspace-2']])
  })

  it('keeps the flyout beside the rail and within varied viewports', async () => {
    const wrapper = mountSwitcher(workspaces)
    const trigger = wrapper.get('.workspace-switcher__button').element
    const triggerBounds = {
      left: 19,
      right: 55,
      top: 100,
      bottom: 136,
      width: 36,
      height: 36,
    }
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(triggerBounds)
    await wrapper.get('.workspace-switcher__button').trigger('click')
    const menu = document.body.querySelector('.workspace-switcher__menu')
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 272,
      top: 0,
      bottom: 160,
      width: 272,
      height: 160,
    })

    const originalViewport = { width: window.innerWidth, height: window.innerHeight }
    const sizes = [
      [1366, 768],
      [1366, 600],
      [1000, 700],
      [1092, 614],
    ]

    try {
      for (const [width, height] of sizes) {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
        window.dispatchEvent(new Event('resize'))
        await flushPromises()

        const left = Number.parseFloat(menu.style.left)
        const top = Number.parseFloat(menu.style.top)
        expect(left).toBeGreaterThanOrEqual(8)
        expect(left + 272).toBeLessThanOrEqual(width - 8)
        expect(left).toBeGreaterThanOrEqual(triggerBounds.right + 28)
        expect(top).toBeGreaterThanOrEqual(8)
        expect(top + 160).toBeLessThanOrEqual(height - 8)
      }
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalViewport.width,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalViewport.height,
      })
    }
  })

  it('shows the active check and admin role, including with a single workspace', async () => {
    const wrapper = mountSwitcher(workspaces.slice(0, 1))
    await wrapper.get('.workspace-switcher__button').trigger('click')

    const flyout = document.body.querySelector('[role="menu"]')
    expect(flyout.querySelectorAll('[role="menuitem"]')).toHaveLength(1)
    expect(flyout.textContent).toContain('Admin')
    expect(flyout.querySelector('.workspace-switcher__check')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('.workspace-switcher__button').element)
  })
})
