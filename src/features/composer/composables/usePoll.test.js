import { beforeEach, describe, expect, it, vi } from 'vitest'

const pollApi = vi.hoisted(() => ({
  closePoll: vi.fn(),
  createPoll: vi.fn(),
  getPollQuestions: vi.fn(),
  getPollResult: vi.fn(),
  submitPollAnswer: vi.fn(),
}))
vi.mock('../api/polls.api', () => pollApi)

import { usePoll } from './usePoll'

describe('usePoll', () => {
  beforeEach(() => Object.values(pollApi).forEach((mock) => mock.mockReset()))

  it('exposes loading and data while creating a poll', async () => {
    let resolveRequest
    pollApi.createPoll.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const poll = usePoll()
    const request = poll.createPoll('channel-1', { title: 'Lunch' })

    expect(poll.loading.value).toBe(true)
    resolveRequest({ id: 'poll-1' })
    await expect(request).resolves.toEqual({ id: 'poll-1' })
    expect(poll.data.value).toEqual({ id: 'poll-1' })
    expect(poll.loading.value).toBe(false)
    expect(poll.error.value).toBe('')
  })

  it('prevents a second action while a request is in flight', async () => {
    let resolveRequest
    pollApi.submitPollAnswer.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const poll = usePoll()
    const request = poll.submitPollAnswer({ poll_id: 'poll-1' })

    await expect(poll.closePoll('poll-1')).resolves.toBeNull()
    expect(pollApi.closePoll).not.toHaveBeenCalled()
    resolveRequest({ accepted: true })
    await request
  })

  it('records a friendly error and rethrows request failures', async () => {
    const requestError = new Error('Poll is closed.')
    pollApi.getPollResult.mockImplementation(() => Promise.reject(requestError))
    const poll = usePoll()

    let caughtError
    try {
      await poll.getPollResult({ poll_id: 'poll-1' })
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toBe(requestError)
    expect(poll.error.value).toBe('Poll is closed.')
    expect(poll.loading.value).toBe(false)
  })

  it('shows backend field validation details', async () => {
    const requestError = Object.assign(new Error('Validation failed'), {
      details: { errors: { 'questions.0.text': ['The question text field is required.'] } },
    })
    pollApi.createPoll.mockImplementation(() => Promise.reject(requestError))
    const poll = usePoll()

    try {
      await poll.createPoll('channel-1', { title: 'QA poll' })
    } catch {
      // The composable keeps request rejection semantics for callers.
    }

    expect(poll.error.value).toBe('The question text field is required.')
  })
})