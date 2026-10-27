import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useUiStore } from '@/stores/ui'
import { helpPages, helpSlides } from '../help/helpContent'
import HelpDrawer from './HelpDrawer.vue'

afterEach(() => {
  delete Element.prototype.scrollIntoView
})

function mountDrawer() {
  const pinia = createPinia()
  const wrapper = mount(HelpDrawer, {
    global: { plugins: [pinia], stubs: { teleport: true } },
  })
  return { wrapper, ui: useUiStore(pinia) }
}

function buttonWithText(wrapper, text) {
  const button = wrapper.findAll('button').find((b) => b.text() === text)
  if (!button) throw new Error(`No button with text "${text}"`)
  return button
}

function resultTitles(wrapper) {
  return wrapper
    .get('[data-testid="help-search-results"]')
    .findAll('button')
    .map((button) => button.find('span').text())
}

describe('HelpDrawer overview', () => {
  it('shows the header icons, search, carousel and the four topics', () => {
    const { wrapper } = mountDrawer()

    expect(wrapper.text()).toContain('Find answers quickly')
    expect(wrapper.text()).toContain('Discover more')
    expect(wrapper.text()).toContain('Explore help topics')
    expect(wrapper.text()).toContain(helpSlides[0].title)
    expect(wrapper.find('button[aria-label="Keyboard shortcuts"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="What\'s New"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Close Help"]').exists()).toBe(true)
    for (const page of helpPages) {
      expect(buttonWithText(wrapper, page.title).exists()).toBe(true)
    }
  })

  it('moves through the carousel and wraps around at both ends', async () => {
    const { wrapper } = mountDrawer()
    const next = wrapper.get('button[aria-label="Next slide"]')
    const prev = wrapper.get('button[aria-label="Previous slide"]')

    await next.trigger('click')
    expect(wrapper.text()).toContain(helpSlides[1].title)

    await prev.trigger('click')
    await prev.trigger('click')
    expect(wrapper.text()).toContain(helpSlides[helpSlides.length - 1].title)

    await next.trigger('click')
    expect(wrapper.text()).toContain(helpSlides[0].title)
  })

  it('shows the slide image instead of the built-in art once a url is set', () => {
    const slide = helpSlides[0]
    const original = slide.media
    slide.media = { name: null, url: 'https://example.com/whats-new.gif' }

    try {
      const { wrapper } = mountDrawer()
      expect(wrapper.get('img').attributes('src')).toBe('https://example.com/whats-new.gif')
    } finally {
      slide.media = original
    }
  })

  it('closes the help panel from the arrow in the header', async () => {
    const { wrapper, ui } = mountDrawer()
    ui.toggleHelpModal()

    await wrapper.get('button[aria-label="Close Help"]').trigger('click')

    expect(ui.helpModalOpen).toBe(false)
  })
})

describe('HelpDrawer pages', () => {
  it('opens Features with numbered articles and goes back to the overview', async () => {
    const { wrapper } = mountDrawer()

    await buttonWithText(wrapper, 'Features').trigger('click')

    expect(wrapper.text()).not.toContain('Explore help topics')
    expect(wrapper.text()).toContain('1:Seamless Communication')
    expect(wrapper.text()).toContain('18:Cmd + K Sort with recent chat')
    expect(wrapper.find('button[aria-label="Close Help"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="Back"]').trigger('click')

    expect(wrapper.text()).toContain('Explore help topics')
    expect(wrapper.find('button[aria-label="Back"]').exists()).toBe(false)
  })

  it("opens What's New from the gift icon with its eight articles", async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('button[aria-label="What\'s New"]').trigger('click')

    expect(wrapper.findAll('section[data-section-id]')).toHaveLength(8)
    expect(wrapper.text()).toContain('Send recent files')
    expect(wrapper.text()).toContain('Channel header avatar')
  })

  it('shows both direct message headings with their bullets', async () => {
    const { wrapper } = mountDrawer()

    await buttonWithText(wrapper, 'Understand direct messages').trigger('click')

    expect(wrapper.text()).toContain('Leverage the Power of Direct Messages on WhistleIt')
    expect(wrapper.text()).toContain('Effortless Access to Direct Messages')
    expect(wrapper.findAll('ul li')).toHaveLength(2)
  })

  it('shows the five Mac notification steps as a numbered list', async () => {
    const { wrapper } = mountDrawer()

    await buttonWithText(wrapper, 'Problem with notification').trigger('click')

    expect(wrapper.text()).toContain('Problem with notification on browser')
    expect(wrapper.findAll('ol li')).toHaveLength(5)
  })

  it('loads images for feature articles using their section ids', async () => {
    const { wrapper } = mountDrawer()

    await buttonWithText(wrapper, 'Features').trigger('click')

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(18)
    expect(images[1].attributes('src')).toContain('features-2')
  })

  it('shows an article image once its link is set', async () => {
    const section = helpPages[0].sections[1]
    section.image = 'https://example.com/enhanced-visuals.gif'

    try {
      const { wrapper } = mountDrawer()
      await buttonWithText(wrapper, 'Features').trigger('click')

      const image = wrapper.get('img[alt="Enhanced Visuals"]')
      expect(image.attributes('src')).toBe('https://example.com/enhanced-visuals.gif')
      expect(image.attributes('alt')).toBe('Enhanced Visuals')
    } finally {
      delete section.image
    }
  })
})

describe('HelpDrawer search', () => {
  it('lists matching article titles with the page they are on', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('#help-search').setValue('mute')

    expect(resultTitles(wrapper)).toEqual(['Mute channel with timer', 'Mute channel with timer'])
    const results = wrapper.get('[data-testid="help-search-results"]')
    expect(results.text()).toContain('Features')
    expect(results.text()).toContain("What's New")
  })

  it('tells the user when no article matches', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('#help-search').setValue('zzzz')

    expect(wrapper.get('[data-testid="help-search-results"]').text()).toContain('No articles found')
  })

  it('opens the page and scrolls to the article when a result is clicked', async () => {
    const scrolled = []
    Element.prototype.scrollIntoView = vi.fn(function scrollIntoView() {
      scrolled.push(this.dataset.sectionId)
    })
    const { wrapper } = mountDrawer()

    await wrapper.get('#help-search').setValue('channel header')
    await wrapper.get('[data-testid="help-search-results"] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('button[aria-label="Back"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Channel header avatar')
    expect(scrolled).toEqual(['whats-new-8'])
  })

  it('opens the first result when Enter is pressed', async () => {
    const { wrapper } = mountDrawer()
    const input = wrapper.get('#help-search')

    await input.setValue('mention')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Use mentions in Whistleit')
    expect(wrapper.find('button[aria-label="Back"]').exists()).toBe(true)
  })

  it('closes the results when focus leaves the search box', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('#help-search').setValue('features')
    expect(wrapper.find('[data-testid="help-search-results"]').exists()).toBe(true)

    await wrapper.get('#help-search').trigger('focusout', { relatedTarget: null })

    expect(wrapper.find('[data-testid="help-search-results"]').exists()).toBe(false)
  })
})

describe('HelpDrawer keyboard shortcuts', () => {
  it('opens the shortcuts dialog from the keyboard icon and closes it with Escape', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('button[aria-label="Keyboard shortcuts"]').trigger('click')

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('Keyboard Shortcuts')
    expect(dialog.text()).toContain('Copy message:')
    expect(dialog.text()).toContain('Open help drawer:')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes the shortcuts dialog with its close button', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('button[aria-label="Keyboard shortcuts"]').trigger('click')
    await wrapper.get('[role="dialog"] button[aria-label="Close"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('opens the shortcuts dialog from a search result', async () => {
    const { wrapper } = mountDrawer()

    await wrapper.get('#help-search').setValue('keyboard')
    await wrapper.get('[data-testid="help-search-results"] button').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })
})
