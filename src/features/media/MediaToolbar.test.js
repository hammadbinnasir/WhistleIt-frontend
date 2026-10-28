import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MediaToolbar from './MediaToolbar.vue'

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h, ref } = await import('vue')

  return {
    default: defineComponent({
      props: {
        native: Boolean,
      },
      setup() {
        const activeGroup = ref('')

        return (props) =>
          h('div', [
            h('div', { class: 'v3-header' }, [
              h(
                'div',
                { class: 'v3-groups' },
                ['recent', 'smileys_people', 'animals_nature'].map((group) =>
                  h(
                    'button',
                    {
                      class: 'v3-group',
                      type: 'button',
                      onClick: () => (activeGroup.value = group),
                    },
                    group,
                  ),
                ),
              ),
              h(
                'div',
                { class: 'v3-search' },
                h('input', {
                  type: 'text',
                  placeholder: 'Search ...',
                  'aria-label': 'Library emoji search',
                  onInput: (event) => (activeGroup.value = event.target.value),
                }),
              ),
            ]),
            h('div', {
              class: 'emoji-picker-library-mock',
              'data-native': String(props.native),
              'data-active-group': activeGroup.value,
            }),
          ])
      },
    }),
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('media toolbar GIF picker', () => {
  it('opens on the nature category with the library emoji rendering', async () => {
    const wrapper = mount(MediaToolbar)
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')

    expect(wrapper.get('.emoji-picker').attributes('data-active-category')).toBe('animals_nature')
    expect(wrapper.get('.emoji-picker-library-mock').attributes('data-active-group')).toBe(
      'animals_nature',
    )
    expect(wrapper.get('.emoji-picker-library-mock').attributes('data-native')).toBe('false')
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)

    const emojiSearch = wrapper.get('input[aria-label="Search emoji"]')
    await emojiSearch.setValue('cat')
    expect(emojiSearch.element.value).toBe('cat')
    expect(wrapper.get('.emoji-picker').attributes('data-searching')).toBe('true')
    expect(wrapper.get('input[aria-label="Library emoji search"]').element.value).toBe('cat')

    const blur = vi.spyOn(emojiSearch.element, 'blur')
    await wrapper.get('.v3-group').trigger('click')
    expect(blur).toHaveBeenCalled()

    await emojiSearch.setValue('')
    expect(wrapper.get('.emoji-picker').attributes('data-searching')).toBe('false')
    expect(wrapper.get('input[aria-label="Library emoji search"]').element.value).toBe('')
  })

  it('searches the Open GIF catalog by typed text and emits the selected GIF', async () => {
    const catalogUrl = 'https://raw.githubusercontent.com/bryanstedman/gifAPI/gh-pages/gifs.json'
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'cat-dance', url: 'http://gifapi.co/cat-dance.gif', tags: ['cats', 'dance'] },
        { name: 'dog-wave', url: 'http://gifapi.co/dog-wave.gif', tags: ['dog', 'hello'] },
      ],
    })
    vi.stubGlobal('fetch', fetch)

    const wrapper = mount(MediaToolbar)
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    await wrapper.get('[role="tab"][aria-label="GIFs"]').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(catalogUrl)

    const gifSearch = wrapper.get('input[aria-label="Search GIFs"]')
    vi.useFakeTimers()
    await gifSearch.setValue('cats')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(wrapper.find('.emoji-picker__library').exists()).toBe(false)
    expect(gifSearch.element.value).toBe('cats')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.emoji-picker__gif')).toHaveLength(1)
    expect(wrapper.get('img[alt="cat dance"]').attributes('src')).toBe(
      'https://raw.githubusercontent.com/bryanstedman/gifAPI/gh-pages/cat-dance.gif',
    )

    await wrapper.get('button[aria-label="Send GIF: cat dance"]').trigger('click')
    expect(wrapper.emitted('action')).toEqual([
      [
        'gif',
        {
          url: 'https://raw.githubusercontent.com/bryanstedman/gifAPI/gh-pages/cat-dance.gif',
          title: 'cat dance',
        },
      ],
    ])
    expect(wrapper.find('.emoji-picker').exists()).toBe(false)
  })

  it('shows an Open GIF API error and lets the user retry', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetch)

    const wrapper = mount(MediaToolbar)
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    await wrapper.get('[role="tab"][aria-label="GIFs"]').trigger('click')

    await flushPromises()
    expect(wrapper.text()).toContain('Open GIF API returned 503')

    await wrapper.get('.emoji-picker__gif-status button').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('No GIFs found')
  })
})
