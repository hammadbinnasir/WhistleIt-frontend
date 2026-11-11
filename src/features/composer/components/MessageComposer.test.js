import { flushPromises, mount } from '@vue/test-utils'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const voiceNoteApi = vi.hoisted(() => ({
  discardVoiceNote: vi.fn(),
  getVoiceNote: vi.fn(),
  getVoiceNoteFile: vi.fn(),
  uploadVoiceNote: vi.fn(),
}))

vi.mock('../../media/voiceNotesApi', () => voiceNoteApi)

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      emits: ['select'],
      setup(_, { emit }) {
        const categories = [
          'Frequently used',
          'Smileys & People',
          'Animals & Nature',
          'Food & Drink',
          'Activities',
          'Travel places',
          'Objects',
          'Symbols',
          'Flags',
        ]

        return () =>
          h('div', [
            h(
              'div',
              { class: 'v3-header' },
              h(
                'div',
                { class: 'v3-groups' },
                categories.map((category) =>
                  h('button', { class: 'v3-group', title: category, 'aria-label': category }),
                ),
              ),
            ),
            h('input', { 'aria-label': 'Search emojis' }),
            h(
              'button',
              { 'aria-label': 'beaming face', onClick: () => emit('select', { i: '😁' }) },
              '😁',
            ),
          ])
      },
    }),
  }
})

import MessageComposer from './MessageComposer.vue'
import MediaToolbar from '../../media/MediaToolbar.vue'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'

beforeEach(() => {
  resetUserStore()
  voiceNoteApi.uploadVoiceNote.mockResolvedValue({ id: 'voice-note-1' })
  voiceNoteApi.getVoiceNote.mockResolvedValue({ id: 'voice-note-1' })
  voiceNoteApi.getVoiceNoteFile.mockRejectedValue(new Error('Preview unavailable in test'))
  voiceNoteApi.discardVoiceNote.mockResolvedValue(undefined)
})
afterEach(() => {
  resetUserStore()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setEditorText(wrapper, text) {
  const editor = wrapper.get('[contenteditable="true"]')

  editor.element.textContent = text

  editor.element.dispatchEvent(new Event('input', { bubbles: true }))

  return editor
}

function selectEditorText(editor) {
  editor.element.focus()

  const range = document.createRange()

  range.selectNodeContents(editor.element)

  const selection = document.getSelection()

  selection.removeAllRanges()

  selection.addRange(range)
}

function stubVoiceRecorder() {
  const stream = { getTracks: () => [{ stop: vi.fn() }] }
  const recorders = []
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  })
  vi.stubGlobal(
    'MediaRecorder',
    class extends EventTarget {
      static isTypeSupported = () => true
      mimeType = 'audio/webm'
      state = 'inactive'

      constructor(...args) {
        super(...args)
        recorders.push(this)
      }

      start(timeslice) {
        this.timeslice = timeslice
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        for (const chunk of ['complete-', 'recording']) {
          const dataEvent = new Event('dataavailable')
          Object.defineProperty(dataEvent, 'data', { value: new Blob([chunk]) })
          this.dispatchEvent(dataEvent)
        }
        this.dispatchEvent(new Event('stop'))
      }
    },
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { stream, recorders }
}

describe('message composer', () => {
  it('records, uploads, previews, and sends a voice-note ID', async () => {
    const { recorders } = stubVoiceRecorder()

    const wrapper = mount(MessageComposer, {
      attachTo: document.body,
      props: { channelId: 'channel-1' },
    })
    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Voice Message Recording',
    )
    expect(document.querySelector('[role="timer"]')?.textContent).toContain('00:00:00')
    expect(voiceNoteApi.uploadVoiceNote).not.toHaveBeenCalled()

    document.querySelector('button.message-composer__recording-stop').click()
    await flushPromises()

    expect(voiceNoteApi.uploadVoiceNote).toHaveBeenCalledOnce()
    expect(voiceNoteApi.uploadVoiceNote.mock.calls[0][1]).toMatchObject({
      channelId: 'channel-1',
      duration: 1,
    })
    expect(recorders[0].timeslice).toBe(1000)
    await expect(voiceNoteApi.uploadVoiceNote.mock.calls[0][0].text()).resolves.toBe(
      'complete-recording',
    )
    expect(voiceNoteApi.getVoiceNote).toHaveBeenCalledWith('voice-note-1')
    expect(wrapper.text()).not.toContain('Voice message')
    expect(wrapper.find('.message-composer__voice-status').exists()).toBe(false)
    expect(wrapper.get('.message-composer__voice-draft audio').attributes('src')).toBe(
      'blob:voice-preview',
    )
    expect(wrapper.get('.message-composer__voice-discard').attributes('aria-label')).toBe(
      'Discard recording',
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.get('button[aria-label="Send message"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')).toEqual([[{ content: '', voiceNoteId: 'voice-note-1' }]])
    wrapper.unmount()
  })

  it('associates direct-message voice uploads with their DM channel', async () => {
    stubVoiceRecorder()

    const wrapper = mount(MessageComposer, {
      attachTo: document.body,
      props: { channelId: 'direct-channel-1', conversationType: 'dm' },
    })
    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()
    document.querySelector('button.message-composer__recording-stop').click()
    await flushPromises()

    expect(voiceNoteApi.uploadVoiceNote.mock.calls[0][1]).toMatchObject({
      channelId: 'direct-channel-1',
      duration: 1,
    })
    wrapper.unmount()
  })

  it('discards an uploaded voice-note draft', async () => {
    stubVoiceRecorder()
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()
    document.querySelector('button.message-composer__recording-stop').click()
    await flushPromises()

    await wrapper.get('button[aria-label="Discard recording"]').trigger('click')
    await flushPromises()

    expect(voiceNoteApi.discardVoiceNote).toHaveBeenCalledWith('voice-note-1')
    expect(wrapper.find('.message-composer__voice-draft').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cancels a recording without uploading it', async () => {
    stubVoiceRecorder()
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()
    document.querySelector('button.message-composer__recording-cancel').click()
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(voiceNoteApi.uploadVoiceNote).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows recording UI while microphone permission is pending and cancels safely', async () => {
    let resolveMicrophone
    const stopTrack = vi.fn()
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveMicrophone = resolve
            }),
        ),
      },
    })
    vi.stubGlobal('MediaRecorder', class {})
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Waiting for microphone access',
    )
    document.querySelector('button.message-composer__recording-cancel').click()
    resolveMicrophone({ getTracks: () => [{ stop: stopTrack }] })
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(voiceNoteApi.uploadVoiceNote).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows a clear error when microphone permission is denied', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    })
    vi.stubGlobal('MediaRecorder', class {})
    const wrapper = mount(MessageComposer)

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Could not access the microphone: Permission denied',
    )
    expect(voiceNoteApi.uploadVoiceNote).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('explains that microphone access requires a secure page on insecure origins', async () => {
    vi.stubGlobal('isSecureContext', false)
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })
    vi.stubGlobal('MediaRecorder', class {})
    const wrapper = mount(MessageComposer)

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Open it at http://localhost:5173 on this computer',
    )
    expect(voiceNoteApi.uploadVoiceNote).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders compact bullet and numbered-list icons', () => {
    const wrapper = mount(MessageComposer)

    expect(wrapper.get('button[aria-label="Bulleted list"] svg').classes()).toContain(
      'message-composer__list-icon',
    )
    expect(wrapper.get('button[aria-label="Bulleted list"] svg').attributes('viewBox')).toBe(
      '0 0 24 24',
    )
    expect(wrapper.get('button[aria-label="Bulleted list"] svg circle').attributes('cx')).toBe(
      '3.5',
    )
    expect(wrapper.get('button[aria-label="Numbered list"] svg').classes()).toContain(
      'message-composer__numbered-list-icon',
    )
  })

  it('shows poll and important-message icons in the toolbar', () => {
    const wrapper = mount(MessageComposer)

    expect(wrapper.get('button[aria-label="Insert poll"] svg rect').attributes('x')).toBe('2.5')
    const badge = wrapper.get(
      'button[aria-label="Important message"] .message-composer__important-badge',
    )
    expect(badge.attributes('cx')).toBe('19.5')
    expect(badge.attributes('cy')).toBe('17.5')
    expect(badge.attributes('r')).toBe('4')
    expect(
      wrapper
        .get('button[aria-label="Important message"] .message-composer__important-badge-mark')
        .exists(),
    ).toBe(true)
  })

  it('opens the poll dialog and adds a configured poll to the message draft', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    setEditorText(wrapper, 'Before the poll')

    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    expect(
      document.querySelector('[role="dialog"][aria-labelledby="message-poll-title"]'),
    ).not.toBeNull()
    expect(document.querySelectorAll('.message-composer__poll-option')).toHaveLength(3)

    const titleInput = document.querySelector('#poll-title-input')
    titleInput.value = 'Lunch vote'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    const questionInput = document.querySelector('#poll-question-0')
    questionInput.value = 'What should we order?'
    questionInput.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelectorAll('.message-composer__poll-option input')[0].value = 'Pizza'
    document
      .querySelectorAll('.message-composer__poll-option input')[0]
      .dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelectorAll('.message-composer__poll-option input')[1].value = 'Salad'
    document
      .querySelectorAll('.message-composer__poll-option input')[1]
      .dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.message-composer__poll-add-choice').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelectorAll('.message-composer__poll-option')).toHaveLength(4)

    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-composer__poll-placeholder h3').textContent).toBe(
      'Configure your poll',
    )
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-schedule-option input').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-footer .message-composer__poll-next').click()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[contenteditable="true"]').text()).toBe('')
    expect(wrapper.find('.message-composer__poll-draft').exists()).toBe(false)
    expect(wrapper.emitted('send')[0][0].content).toContain('Before the poll')
    expect(wrapper.emitted('send')[0][0].poll.title).toBe('Lunch vote')
    expect(
      document.querySelector('[role="dialog"][aria-labelledby="message-poll-title"]'),
    ).toBeNull()
    wrapper.unmount()
  })

  it('supports open-ended and rating questions with a selectable rating scale', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    const typeTrigger = document.querySelector('#poll-type-0')
    typeTrigger.click()
    await wrapper.vm.$nextTick()
    expect(
      [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent.trim()),
    ).toEqual(['Open Ended', 'Choice', 'Rating'])

    document.querySelector('[role="option"][aria-selected="false"]').click()
    await wrapper.vm.$nextTick()
    expect(typeTrigger.textContent.trim()).toContain('Open Ended')
    expect(document.querySelector('#poll-rating-type-0')).toBeNull()
    expect(document.querySelector('.message-composer__poll-options')).toBeNull()
    expect(document.querySelector('.message-composer__poll-toggles label:nth-child(2)')).toBeNull()

    typeTrigger.click()
    await wrapper.vm.$nextTick()
    document.querySelector('[role="option"]:last-child').click()
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(typeTrigger)
    const ratingSelect = document.querySelector('#poll-rating-type-0')
    expect(ratingSelect.value).toBe('1-5')
    expect(
      [...document.querySelectorAll('.message-composer__poll-option input')].map(
        (input) => input.value,
      ),
    ).toEqual(['1', '2', '3', '4', '5'])
    ratingSelect.value = '1-10'
    ratingSelect.dispatchEvent(new Event('change', { bubbles: true }))
    ratingSelect.focus()
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(ratingSelect)
    expect(document.querySelectorAll('.message-composer__poll-option input')).toHaveLength(10)

    const titleInput = document.querySelector('#poll-title-input')
    titleInput.focus()
    expect(document.activeElement).toBe(titleInput)
    titleInput.value = 'Team feedback'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    const questionInput = document.querySelector('#poll-question-0')
    questionInput.value = 'How was the meeting?'
    questionInput.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-schedule-option input').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-footer .message-composer__poll-next').click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.message-composer__poll-draft').exists()).toBe(false)
    expect(wrapper.emitted('send')[0][0].poll.title).toBe('Team feedback')
    expect(document.querySelector('.message-composer__poll-modal')).toBeNull()
    wrapper.unmount()
  })

  it('allows a poll scheduled to start later', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    document.querySelector('#poll-title-input').value = 'Scheduled poll'
    document.querySelector('#poll-title-input').dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('#poll-question-0').value = 'What time works?'
    document.querySelector('#poll-question-0').dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.message-composer__poll-option input').value = 'Morning'
    document
      .querySelector('.message-composer__poll-option input')
      .dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelectorAll('.message-composer__poll-option input')[1].value = 'Evening'
    document
      .querySelectorAll('.message-composer__poll-option input')[1]
      .dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    const scheduleOptions = document.querySelectorAll(
      '.message-composer__poll-schedule-option input',
    )
    scheduleOptions[1].click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-footer .message-composer__poll-next').click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')[0][0].poll.scheduleStart).toBeTruthy()
    expect(wrapper.emitted('send')[0][0].poll.startNow).toBe(false)
    wrapper.unmount()
  })

  it('enables Create Poll when start and end schedules are set without Start now', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    document.querySelector('#poll-title-input').value = 'Timed poll'
    document.querySelector('#poll-title-input').dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('#poll-question-0').value = 'Choose a time'
    document.querySelector('#poll-question-0').dispatchEvent(new Event('input', { bubbles: true }))
    const options = document.querySelectorAll('.message-composer__poll-option input')
    options[0].value = 'Morning'
    options[0].dispatchEvent(new Event('input', { bubbles: true }))
    options[1].value = 'Evening'
    options[1].dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()

    const scheduleOptions = document.querySelectorAll(
      '.message-composer__poll-schedule-option input',
    )
    scheduleOptions[1].click()
    scheduleOptions[2].click()
    await wrapper.vm.$nextTick()

    expect(
      document.querySelector('.message-composer__poll-footer .message-composer__poll-next')
        .disabled,
    ).toBe(false)
    wrapper.unmount()
  })

  it('moves between poll steps with the Previous button', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    const previous = document.querySelector('.message-composer__poll-previous')
    expect(previous.disabled).toBe(true)

    const titleInput = document.querySelector('#poll-title-input')
    titleInput.value = 'Step navigation'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('#poll-type-0').click()
    await wrapper.vm.$nextTick()
    document.querySelector('[role="option"]:first-child').click()
    await wrapper.vm.$nextTick()
    const questionInput = document.querySelector('#poll-question-0')
    questionInput.value = 'Which option?'
    questionInput.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    document.querySelector('.message-composer__poll-next').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-composer__poll-placeholder h3').textContent).toBe(
      'Configure your poll',
    )
    expect(previous.disabled).toBe(false)

    previous.click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('#poll-title-input').value).toBe('Step navigation')
    expect(document.querySelector('#poll-question-0').value).toBe('Which option?')
    wrapper.unmount()
  })

  it('keeps Configure and Schedule locked until required poll fields are filled', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    await wrapper.get('button[aria-label="Insert poll"]').trigger('click')

    expect(document.querySelector('#poll-title-input').getAttribute('aria-invalid')).toBe('false')
    expect(document.querySelector('#poll-question-0').getAttribute('aria-invalid')).toBe('true')
    expect(document.querySelectorAll('.message-composer__poll-validation-error')).toHaveLength(1)
    const pollQuestion = document.querySelector('#poll-question-0')
    expect(pollQuestion.getAttribute('placeholder')).toBe('Type your question')
    expect(document.querySelector('.message-composer__poll-question-floating-label')).toBeNull()
    expect(
      document.querySelector('.message-composer__poll-validation-error').textContent.trim(),
    ).toBe('This is a required field')

    document.querySelector('[aria-label="Poll creation steps"] button:nth-child(2)').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-composer__poll-placeholder')).toBeNull()
    expect(document.querySelector('#poll-title-input').getAttribute('aria-invalid')).toBe('true')
    expect(document.querySelector('#poll-question-0').getAttribute('aria-invalid')).toBe('true')
    expect(
      document.querySelector('.message-composer__poll-validation-error').textContent.trim(),
    ).toBe('This is a required field')

    const titleInput = document.querySelector('#poll-title-input')
    titleInput.value = 'Lunch vote'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(titleInput.classList.contains('is-invalid')).toBe(true)
    document.querySelector('[aria-label="Poll creation steps"] button:nth-child(3)').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-composer__poll-placeholder')).toBeNull()
    expect(pollQuestion.getAttribute('aria-invalid')).toBe('true')
    pollQuestion.focus()
    await wrapper.vm.$nextTick()
    expect(pollQuestion.getAttribute('placeholder')).toBe('Write here')
    expect(
      document.querySelector('.message-composer__poll-question-floating-label').textContent.trim(),
    ).toBe('Type your question')
    pollQuestion.value = 'What should we order?'
    pollQuestion.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(pollQuestion.classList.contains('is-invalid')).toBe(true)
    expect(pollQuestion.getAttribute('aria-invalid')).toBe('true')
    expect(pollQuestion.getAttribute('placeholder')).toBe('Write here')
    expect(
      document.querySelector('.message-composer__poll-question-floating-label').textContent.trim(),
    ).toBe('Type your question')
    pollQuestion.blur()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.message-composer__poll-question-floating-label')).not.toBeNull()
    expect(
      document.querySelector('.message-composer__poll-validation-error').textContent.trim(),
    ).toBe('This is a required field')

    wrapper.unmount()
  })

  it('sends a non-empty message and clears the editor', async () => {
    const wrapper = mount(MessageComposer)

    const input = setEditorText(wrapper, 'Hello team')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[{ content: 'Hello team' }]])

    expect(input.element.textContent).toBe('')
  })

  it('removes literal paragraph tags from the outgoing message', async () => {
    const wrapper = mount(MessageComposer)
    setEditorText(wrapper, '<p>Aslam u Alikum</p>')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[{ content: 'Aslam u Alikum', attachments: [] }]])
  })

  it('does not send an empty message', async () => {
    const wrapper = mount(MessageComposer)

    expect(wrapper.get('button[aria-label="Send message"]').attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('sends an attachment without requiring message text', async () => {
    const wrapper = mount(MessageComposer)
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })
    const fileInput = wrapper.get('input[type="file"]').element

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await wrapper.vm.$nextTick()
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[{ content: '', attachment }]])
  })

  it('sends a selected recent file with any drafted message text', async () => {
    const wrapper = mount(MessageComposer)
    const recentFile = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    setEditorText(wrapper, 'Please see this')

    wrapper.getComponent(MediaToolbar).vm.$emit('recent-file-selected', recentFile)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')).toEqual([
      [{ content: 'Please see this', attachment: recentFile, attachmentSource: 'recent' }],
    ])
    expect(wrapper.get('[contenteditable="true"]').text()).toBe('')
  })

  it('previews selected images and documents in removable attachment cards', async () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:selected-image')
    URL.revokeObjectURL = vi.fn()

    try {
      const imageWrapper = mount(MessageComposer)
      const image = new File(['image'], 'men.jpg', { type: 'image/jpeg' })
      const imageInput = imageWrapper.get('input[type="file"]').element
      Object.defineProperty(imageInput, 'files', { configurable: true, value: [image] })
      imageInput.dispatchEvent(new Event('change', { bubbles: true }))
      await imageWrapper.vm.$nextTick()

      expect(imageWrapper.get('.message-composer__attachment-thumbnail').attributes('src')).toBe(
        'blob:selected-image',
      )
      expect(imageWrapper.get('.message-composer__attachment-name').text()).toBe('men.jpg')
      await imageWrapper.get('button[aria-label="Remove men.jpg"]').trigger('click')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:selected-image')
      expect(imageWrapper.find('.message-composer__attachment-preview').exists()).toBe(false)
      imageWrapper.unmount()

      const fileWrapper = mount(MessageComposer)
      const documentFile = new File(['doc'], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const fileInput = fileWrapper.get('input[type="file"]').element
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [documentFile] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await fileWrapper.vm.$nextTick()

      expect(fileWrapper.get('.message-composer__attachment-name').text()).toBe('notes.docx')
      expect(fileWrapper.get('.message-composer__attachment-file-icon').exists()).toBe(true)
      fileWrapper.unmount()
    } finally {
      if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL
      else delete URL.createObjectURL
      if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL
      else delete URL.revokeObjectURL
    }
  })

  it('sends the message when Enter is pressed with the default preference', async () => {
    const wrapper = mount(MessageComposer)
    setEditorText(wrapper, 'Send with Enter')

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: 'Send with Enter' }]])
  })

  it('sends on Enter and uses Shift+Enter for a newline regardless of preference', async () => {
    useUserStore().hydrate({ preferences: { enterKey: 'newline' } })
    const wrapper = mount(MessageComposer)
    setEditorText(wrapper, 'Keep typing')

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: 'Keep typing' }]])

    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(shiftEnter)

    expect(shiftEnter.defaultPrevented).toBe(false)
    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('sends an attachment-only message when Enter is pressed', async () => {
    const wrapper = mount(MessageComposer)
    const attachment = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = wrapper.get('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await wrapper.vm.$nextTick()

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: '', attachment }]])
  })

  it('returns focus to the editor after selecting a file so Enter sends it', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const attachment = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = wrapper.get('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(wrapper.get('[contenteditable="true"]').element)
    })
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: '', attachment }]])
    wrapper.unmount()
  })

  it('sends a voice note with Enter after recording upload completes', async () => {
    stubVoiceRecorder()
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')
    await flushPromises()
    document.querySelector('button.message-composer__recording-stop').click()
    await flushPromises()

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(wrapper.get('[contenteditable="true"]').element)
    })
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: '', voiceNoteId: 'voice-note-1' }]])
    wrapper.unmount()
  })

  it('sends text and a selected attachment together with Enter', async () => {
    const wrapper = mount(MessageComposer)
    const attachment = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = wrapper.get('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    setEditorText(wrapper, 'Please see attached')

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('[contenteditable="true"]').element.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toEqual([[{ content: 'Please see attached', attachment }]])
  })

  it('keeps formatting options independently toggleable', async () => {
    const wrapper = mount(MessageComposer)

    const input = setEditorText(wrapper, 'hello')

    selectEditorText(input)

    await wrapper.get('button[aria-label="Bold"]').trigger('click')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('button[aria-label="Bold"]').trigger('click')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')
  })

  it('does not activate bold when applying or removing underline and italic', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'hello')

    selectEditorText(input)

    await wrapper.get('button[aria-label="Underline"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Underline"]').trigger('click')

    await wrapper.get('button[aria-label="Italic"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')

    expect(input.element.innerHTML).toBe('<u><em>hello</em></u>')

    expect(wrapper.get('button[aria-label="Underline"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('button[aria-label="Italic"]').trigger('mousedown')

    await wrapper.get('button[aria-label="Italic"]').trigger('click')

    expect(input.element.innerHTML).toBe('<u>hello</u>')

    expect(wrapper.get('button[aria-label="Underline"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    wrapper.unmount()
  })

  it('applies underline to text typed after activating underline', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = wrapper.get('[contenteditable="true"]')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    await wrapper.get('button[aria-label="Underline"]').trigger('mousedown')
    await wrapper.get('button[aria-label="Underline"]').trigger('click')

    input.element.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'underlined',
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(input.element.innerHTML).toBe('<u>underlined</u>')
    expect(wrapper.get('button[aria-label="Underline"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('inserts newlines in code formatting and sends only on button submit', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'const value = 1')
    selectEditorText(input)

    await wrapper.get('button[aria-label="Code block"]').trigger('mousedown')
    await wrapper.get('button[aria-label="Code block"]').trigger('click')

    expect(input.element.innerHTML).toBe('<code>const value = 1</code>')

    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    const selection = document.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(input.element.textContent).toBe('const value = 1\n')

    input.element.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: '!',
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(input.element.textContent).toBe('const value = 1\n!')
    expect(wrapper.emitted('send')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')).toEqual([[{ content: 'const value = 1\n!', isCode: true }]])
    wrapper.unmount()
  })

  it('types only the remaining active format after toggling bold off', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = wrapper.get('[contenteditable="true"]')

    input.element.focus()

    const range = document.createRange()

    range.selectNodeContents(input.element)

    range.collapse(false)

    const selection = document.getSelection()

    selection.removeAllRanges()

    selection.addRange(range)

    for (const label of ['Bold', 'Italic', 'Bold']) {
      const button = wrapper.get(`button[aria-label="${label}"]`)

      await button.trigger('mousedown')

      await button.trigger('click')
    }

    input.element.focus()

    range.selectNodeContents(input.element)

    range.collapse(false)

    selection.removeAllRanges()

    selection.addRange(range)

    input.element.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',

        data: 'formatted',

        bubbles: true,

        cancelable: true,
      }),
    )

    expect(input.element.innerHTML).toBe('<em>formatted</em>')

    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('false')

    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')

    wrapper.unmount()
  })

  it('toggles a bulleted list on and off for the current text', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)
    const button = wrapper.get('button[aria-label="Bulleted list"]')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(input.element.querySelector('ul > li').textContent).toBe('first')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(input.element.querySelector('ul')).toBeNull()
    expect(input.element.textContent).toBe('first')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')).toEqual([[{ content: 'first' }]])
    wrapper.unmount()
  })

  it('toggles a numbered list on and off for the current text', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)
    const button = wrapper.get('button[aria-label="Numbered list"]')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(input.element.innerHTML).toBe('<ol><li>first</li></ol>')

    await button.trigger('click')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(input.element.querySelector('ol')).toBeNull()
    expect(input.element.textContent).toBe('first')
    wrapper.unmount()
  })

  it('switches between bulleted and numbered lists with only one active', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = setEditorText(wrapper, 'first')
    input.element.focus()
    const range = document.createRange()
    range.selectNodeContents(input.element)
    range.collapse(false)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    const bulletButton = wrapper.get('button[aria-label="Bulleted list"]')
    const numberButton = wrapper.get('button[aria-label="Numbered list"]')

    await bulletButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')
    expect(bulletButton.attributes('aria-pressed')).toBe('true')

    await numberButton.trigger('mousedown')
    await numberButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ol><li>first</li></ol>')
    expect(bulletButton.attributes('aria-pressed')).toBe('false')
    expect(numberButton.attributes('aria-pressed')).toBe('true')

    await bulletButton.trigger('mousedown')
    await bulletButton.trigger('click')
    expect(input.element.innerHTML).toBe('<ul><li>first</li></ul>')
    expect(bulletButton.attributes('aria-pressed')).toBe('true')
    expect(numberButton.attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it.each([
    ['bulleted', 'ul'],
    ['numbered', 'ol'],
  ])('pressing Enter in a %s list starts a new list item', async (_label, tag) => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = wrapper.get('[contenteditable="true"]')
    input.element.innerHTML = `<${tag}><li>first</li></${tag}>`
    input.element.dispatchEvent(new Event('input', { bubbles: true }))

    const text = input.element.querySelector('li').firstChild
    const range = document.createRange()
    range.setStart(text, text.textContent.length)
    range.collapse(true)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(enter)
    await wrapper.vm.$nextTick()

    expect(enter.defaultPrevented).toBe(true)
    expect(input.element.querySelectorAll(`${tag} > li`)).toHaveLength(2)
    expect(input.element.querySelector(`${tag} > li:last-child br`)).not.toBeNull()
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(wrapper.get(`button[aria-label="${tag === 'ul' ? 'Bulleted' : 'Numbered'} list"]`).attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('clears other active formatting buttons when a list button is clicked', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })
    const input = wrapper.get('[contenteditable="true"]')
    input.element.innerHTML = '<strong><em><s>first</s></em></strong>'
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    const text = input.element.querySelector('s').firstChild
    const range = document.createRange()
    range.selectNodeContents(text)
    document.getSelection().removeAllRanges()
    document.getSelection().addRange(range)

    const bulletButton = wrapper.get('button[aria-label="Bulleted list"]')
    await bulletButton.trigger('mousedown')
    expect(wrapper.get('button[aria-label="Bold"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Italic"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Strikethrough"]').attributes('aria-pressed')).toBe(
      'true',
    )

    await bulletButton.trigger('click')

    expect(bulletButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Numbered list"]').attributes('aria-pressed')).toBe(
      'false',
    )
    for (const label of ['Bold', 'Italic', 'Strikethrough', 'Underline', 'Code block']) {
      expect(wrapper.get(`button[aria-label="${label}"]`).attributes('aria-pressed')).toBe('false')
    }
    expect(input.element.querySelector('ul strong em s').textContent).toBe('first')
    wrapper.unmount()
  })

  it('converts ordered list content to a numbered message list', async () => {
    const wrapper = mount(MessageComposer)

    const input = wrapper.get('[contenteditable="true"]')

    input.element.innerHTML = '<ol><li>first</li></ol>'

    input.element.dispatchEvent(new Event('input', { bubbles: true }))

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[{ content: '1. first' }]])
  })

  it('toggles important status independently and includes it when sending', async () => {
    const wrapper = mount(MessageComposer)

    setEditorText(wrapper, 'A critical update')

    const importantButton = wrapper.get('button[aria-label="Important message"]')

    await importantButton.trigger('click')

    await importantButton.trigger('click')

    expect(wrapper.find('.message-composer__important').exists()).toBe(false)

    expect(importantButton.attributes('aria-pressed')).toBe('false')

    await importantButton.trigger('click')

    expect(wrapper.find('.message-composer__important').text()).toBe('IMPORTANT!')

    expect(importantButton.attributes('aria-pressed')).toBe('true')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[{ content: 'A critical update', important: true }]])

    expect(wrapper.find('.message-composer__important').exists()).toBe(false)

    expect(importantButton.attributes('aria-pressed')).toBe('false')
  })

  it('toggles code styling without changing or sending the message', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'const value = 1')

    selectEditorText(input)

    const codeButton = wrapper.get('button[aria-label="Code block"]')

    await codeButton.trigger('mousedown')
    await codeButton.trigger('click')

    expect(input.element.textContent).toBe('const value = 1')
    expect(input.classes()).toContain('message-composer__input--code')
    expect(codeButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.message-composer__code-mode-indicator').text()).toBe('Code mode on')
    expect(wrapper.emitted('send')).toBeUndefined()

    await codeButton.trigger('mousedown')
    await codeButton.trigger('click')

    expect(input.element.textContent).toBe('const value = 1')
    expect(input.classes()).not.toContain('message-composer__input--code')
    expect(codeButton.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('.message-composer__code-mode-indicator').exists()).toBe(false)
    expect(wrapper.emitted('send')).toBeUndefined()
    wrapper.unmount()
  })

  it('schedules a message and clears the editor', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const input = setEditorText(wrapper, 'Reminder')

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('TZ: Asia/Karachi')

    await wrapper.get('button.message-composer__custom-choice').trigger('click')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

    const dialog = document.querySelector('[aria-labelledby="message-schedule-title"]')

    expect(dialog).not.toBeNull()

    expect(dialog.textContent).toContain('Select date')

    expect(dialog.textContent).toContain('Select time')

    expect(dialog.textContent).toContain('Today')

    expect(dialog.textContent).toContain('Save')

    const dateInput = document.querySelector('#message-scheduled-date')

    dateInput.value = '2099-10-23'

    dateInput.dispatchEvent(new Event('input', { bubbles: true }))

    dateInput.dispatchEvent(new Event('change', { bubbles: true }))

    const timeInput = document.querySelector('#message-scheduled-time')

    timeInput.value = '09:30'

    timeInput.dispatchEvent(new Event('input', { bubbles: true }))

    timeInput.dispatchEvent(new Event('change', { bubbles: true }))

    await wrapper.vm.$nextTick()

    document.querySelector('.message-composer__schedule-modal-actions .is-primary').click()

    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('schedule')).toEqual([
      [
        {
          content: 'Reminder',

          scheduledAt: '2099-10-23T09:30',

          timeZone: 'Asia/Karachi',
        },
      ],
    ])

    expect(input.element.textContent).toBe('')

    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).toBeNull()

    wrapper.unmount()
  })

  it('closes the custom schedule modal without scheduling when cancelled', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    setEditorText(wrapper, 'Keep this message')

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('button.message-composer__custom-choice').trigger('click')

    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).not.toBeNull()

    document.querySelector('.message-composer__schedule-modal-actions .is-secondary').click()

    await wrapper.vm.$nextTick()

    expect(document.querySelector('[aria-labelledby="message-schedule-title"]')).toBeNull()

    expect(wrapper.emitted('schedule')).toBeUndefined()

    expect(wrapper.get('[contenteditable="true"]').text()).toBe('Keep this message')

    wrapper.unmount()
  })

  it('schedules from the quick time options in Karachi time', async () => {
    const wrapper = mount(MessageComposer)

    setEditorText(wrapper, 'Quick reminder')

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    const choices = wrapper.findAll('.message-composer__schedule-choice')

    expect(choices[0].text()).toMatch(/^(Today|Tomorrow) at 1:00 PM$/)

    expect(choices[1].text()).toMatch(/^Monday at 9:00 AM$/)

    await choices[0].trigger('click')

    expect(wrapper.emitted('schedule')[0][0]).toMatchObject({
      content: 'Quick reminder',

      timeZone: 'Asia/Karachi',
    })

    expect(wrapper.emitted('schedule')[0][0].scheduledAt).toMatch(/T13:00$/)

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)
  })

  it('closes the schedule menu from outside and Escape', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows a dismissible top-right error when scheduling without text or attachments', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')

    const toast = document.querySelector('.message-composer__schedule-toast')

    expect(toast).not.toBeNull()

    expect(toast.getAttribute('role')).toBe('alert')

    expect(toast.textContent).toContain('Error!')

    expect(toast.textContent).toContain('Type some text or attach files to Schedule.')

    expect(wrapper.find('.message-composer__schedule').exists()).toBe(true)

    document.querySelector('button[aria-label="Dismiss notification"]').click()

    await wrapper.vm.$nextTick()

    expect(document.querySelector('.message-composer__schedule-toast')).toBeNull()

    wrapper.unmount()
  })

  it('allows scheduling an attachment without message text', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const fileInput = wrapper.get('input[type="file"]').element

    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [attachment] })

    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')

    expect(wrapper.emitted('schedule')[0][0]).toMatchObject({
      content: '',

      attachment,

      timeZone: 'Asia/Karachi',
    })

    expect(document.querySelector('.message-composer__schedule-toast')).toBeNull()

    wrapper.unmount()
  })

  it('forwards voice recording actions', async () => {
    const wrapper = mount(MessageComposer)

    await wrapper.get('button[aria-label="Microphone"]').trigger('click')

    expect(wrapper.emitted('microphone')).toHaveLength(1)
  })

  it('opens and dismisses the emoji picker and opens the attachment picker', async () => {
    const wrapper = mount(MessageComposer, { attachTo: document.body })

    const editor = setEditorText(wrapper, 'Hello')

    selectEditorText(editor)

    await wrapper.get('button[aria-label="Emoji"]').trigger('mousedown')
    await wrapper.get('button[aria-label="Emoji"]').trigger('click')
    expect(wrapper.get('.picker').exists()).toBe(true)

    await wrapper.get('button[aria-label="Animals & Nature"]').trigger('click')
    expect(wrapper.get('.picker').attributes('data-active-category')).toBe('animals_nature')

    await wrapper.get('button[aria-label="beaming face"]').trigger('click')
    expect(wrapper.find('.picker').exists()).toBe(false)

    const fileInput = wrapper.get('input[type="file"]')

    const clickFileInput = vi.spyOn(fileInput.element, 'click')

    await wrapper.get('button[aria-label="Attachment"]').trigger('click')

    expect(clickFileInput).toHaveBeenCalledOnce()

    wrapper.unmount()
  })
})
