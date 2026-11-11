import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const recentFilesApi = vi.hoisted(() => ({
  listRecentFiles: vi.fn(),
  downloadRecentFile: vi.fn(),
  recentFileDate: (file) => file?.created_at,
  recentFileId: (file) => file?.id,
  recentFileName: (file) => file?.name,
}))

vi.mock('./recentFilesApi', () => recentFilesApi)

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
  recentFilesApi.listRecentFiles.mockReset()
  recentFilesApi.downloadRecentFile.mockReset()
})

describe('media toolbar emoji picker', () => {
  it('only allows selecting one attachment at a time', () => {
    const wrapper = mount(MediaToolbar)

    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeUndefined()
  })

  it('keeps the attachment picker separate from recent files', async () => {
    recentFilesApi.listRecentFiles.mockResolvedValue([])
    const wrapper = mount(MediaToolbar, { props: { companyId: 'company-1' } })
    const inputClick = vi.spyOn(wrapper.get('input[type="file"]').element, 'click')

    await wrapper.get('button[aria-label="Attachment"]').trigger('click')
    expect(inputClick).toHaveBeenCalledOnce()
    expect(recentFilesApi.listRecentFiles).not.toHaveBeenCalled()

    await wrapper.get('button[aria-label="Recent files"]').trigger('click')
    await flushPromises()
    expect(inputClick).toHaveBeenCalledOnce()
    expect(recentFilesApi.listRecentFiles).toHaveBeenCalledWith('company-1')

    wrapper.unmount()
  })

  it('prepares the selected recent file as binary before emitting it', async () => {
    const file = {
      id: 'file-1',
      name: 'report.pdf',
      mime_type: 'application/pdf',
      created_at: '2026-11-10T10:00:00Z',
      path: 'messages/report.pdf',
    }
    const binaryFile = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    recentFilesApi.listRecentFiles.mockResolvedValue([file])
    recentFilesApi.downloadRecentFile.mockResolvedValue(binaryFile)
    const wrapper = mount(MediaToolbar, { props: { companyId: 'company-1' } })

    await wrapper.get('button[aria-label="Recent files"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('.recent-files__status').exists()).toBe(false)
    })

    expect(wrapper.get('[role="dialog"]').text()).toContain('Recent Files')
    expect(wrapper.get('.recent-files__details').text()).toContain('report.pdf')
    expect(wrapper.get('.recent-files__details').text()).toContain('PDF')
    await wrapper.get('button[aria-label="Share report.pdf"]').trigger('click')
    expect(recentFilesApi.downloadRecentFile).toHaveBeenCalledWith(file)
    expect(wrapper.emitted('recent-file-selected')).toEqual([[binaryFile]])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows preparing state while the recent file downloads', async () => {
    let finishDownload
    recentFilesApi.listRecentFiles.mockResolvedValue([
      { id: 'file-1', name: 'report.pdf', downloadUrl: 'https://files.test/report.pdf' },
    ])
    recentFilesApi.downloadRecentFile.mockReturnValue(
      new Promise((resolve) => {
        finishDownload = resolve
      }),
    )
    const wrapper = mount(MediaToolbar, { props: { companyId: 'company-1' } })
    await wrapper.get('button[aria-label="Recent files"]').trigger('click')
    await flushPromises()

    await wrapper.get('button[aria-label="Share report.pdf"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.recent-files__details').text()).toContain('Preparing file')
    expect(wrapper.get('button[aria-label="Preparing report.pdf"]').attributes('aria-busy')).toBe(
      'true',
    )

    finishDownload(new File(['report'], 'report.pdf', { type: 'application/pdf' }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
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
