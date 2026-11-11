import { ApiRequestError, apiRequest } from '@/lib/api/client'

const POLL_QUESTIONS_PATH = '/v1/poll/get-question'
const POLL_RESULTS_PATH = '/v1/poll/get-result'

function requireId(value, label) {
  if (value == null || value === '') {
    throw new ApiRequestError(`A ${label} is required.`, { status: 400 })
  }
  return encodeURIComponent(value)
}

function withQuery(path, params) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)))
      return
    }
    query.set(key, String(value))
  })
  const search = query.toString()
  return search ? `${path}?${search}` : path
}

function parsedData(response) {
  return response?.data ?? response
}

export async function createPoll(channelId, payload) {
  const path = `/v1/${requireId(channelId, 'channel ID')}/polls`
  return parsedData(
    await apiRequest(path, { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export async function submitPollAnswer(payload) {
  return parsedData(
    await apiRequest('/v1/poll/answer', { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export async function getPollQuestions(queryParams = {}) {
  return parsedData(await apiRequest(withQuery(POLL_QUESTIONS_PATH, queryParams)))
}

export async function getPollResult(queryParams = {}) {
  return parsedData(await apiRequest(withQuery(POLL_RESULTS_PATH, queryParams)))
}

export async function closePoll(pollId, payload) {
  const options = { method: 'PUT' }
  if (payload !== undefined) options.body = JSON.stringify(payload)
  return parsedData(
    await apiRequest(`/v1/polls/${requireId(pollId, 'poll ID')}/close`, options),
  )
}