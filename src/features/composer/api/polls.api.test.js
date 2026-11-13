import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual('@/lib/api/client')
  return { ...actual, apiRequest }
})

import {
  closePoll,
  createPoll,
  getPollQuestions,
  getPollResult,
  listPolls,
  submitPollAnswer,
} from './polls.api'
import { ApiRequestError } from '@/lib/api/client'

describe('composer polls API', () => {
  beforeEach(() => apiRequest.mockReset())

  it('creates a poll for the encoded channel and returns response data', async () => {
    const payload = { title: 'Lunch', questions: [] }
    apiRequest.mockResolvedValue({ success: true, data: { id: 'poll-1' } })

    await expect(createPoll('channel 1', payload)).resolves.toEqual({ id: 'poll-1' })
    expect(apiRequest).toHaveBeenCalledWith('/v1/channel%201/polls', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })

  it('submits answers to the poll answer endpoint', async () => {
    const payload = { poll_id: 'poll-1', answers: ['choice-1'] }
    apiRequest.mockResolvedValue({ success: true, data: { accepted: true } })

    await expect(submitPollAnswer(payload)).resolves.toEqual({ accepted: true })
    expect(apiRequest).toHaveBeenCalledWith('/v1/poll/answer', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })

  it('loads polls from the history endpoint', async () => {
    const polls = [{ id: 'poll-1', channel_id: 'channel-1', title: 'Lunch' }]
    apiRequest.mockResolvedValue({ success: true, data: { polls } })

    await expect(listPolls('channel-1')).resolves.toEqual(polls)
    expect(apiRequest).toHaveBeenCalledWith('/v1/polls?channel_id=channel-1')
  })

  it('rejects an invalid poll history response', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { message: 'No poll list' } })

    await expect(listPolls('channel-1')).rejects.toThrow(
      'The server returned an invalid polls list.',
    )
  })

  it('requires a channel ID before loading polls', async () => {
    await expect(listPolls('')).rejects.toThrow('A channel ID is required.')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('keeps question and result query parameters caller-supplied', async () => {
    apiRequest.mockResolvedValue({ success: true, data: [] })

    await expect(
      getPollQuestions({ poll_id: 'poll 1', include: ['choices', 'status'] }),
    ).resolves.toEqual([])
    await expect(getPollResult({ result: 'backend-defined' })).resolves.toEqual([])
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/v1/poll/get-question?poll_id=poll+1&include=choices&include=status',
    )
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/v1/poll/get-result?result=backend-defined')
  })

  it('gets poll results by channel and poll ID', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { results: [] } })

    await expect(getPollResult({ channel_id: 'channel 1', poll_id: 'poll 1' })).resolves.toEqual({
      results: [],
    })
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/poll/get-result?channel_id=channel+1&poll_id=poll+1',
    )
  })

  it('closes a poll with an optional payload', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { closed: true } })

    await expect(closePoll('poll/1')).resolves.toEqual({ closed: true })
    expect(apiRequest).toHaveBeenCalledWith('/v1/polls/poll%2F1/close', { method: 'PUT' })
  })

  it('throws a normalized error before requesting with a missing channel ID', async () => {
    let requestError
    try {
      await createPoll('', { title: 'Lunch' })
    } catch (error) {
      requestError = error
    }

    expect(requestError).toBeInstanceOf(ApiRequestError)
    expect(requestError.status).toBe(400)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
