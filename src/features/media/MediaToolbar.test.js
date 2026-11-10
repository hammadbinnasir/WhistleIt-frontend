import { mount } from '@vue/test-utils'
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
  vi.restoreAllMocks()
})

describe('media toolbar emoji picker', () => {
  it('only allows selecting one attachment at a time', () => {
    const wrapper = mount(MediaToolbar)

    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeUndefined()
  })

  it('opens on the nature category with the library emoji rendering', async () => {
    const wrapper = mount(MediaToolbar)
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')

    expect(wrapper.get('.emoji-picker').attributes('data-active-category')).toBe('animals_nature')
    expect(wrapper.get('.emoji-picker-library-mock').attributes('data-active-group')).toBe(
      'animals_nature',
    )
    expect(wrapper.get('.emoji-picker-library-mock').attributes('data-native')).toBe('false')
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="GIFs"]').exists()).toBe(false)
    expect(wrapper.find('input[aria-label="Search GIFs"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Video"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Microphone"]').exists()).toBe(true)

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
})
