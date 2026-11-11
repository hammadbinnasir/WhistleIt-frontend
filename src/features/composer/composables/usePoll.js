import { ref } from 'vue'
import {
  closePoll as closePollRequest,
  createPoll as createPollRequest,
  getPollQuestions as getPollQuestionsRequest,
  getPollResult as getPollResultRequest,
  submitPollAnswer as submitPollAnswerRequest,
} from '../api/polls.api'

function requestErrorMessage(error) {
  const validationErrors = error?.details?.errors ?? error?.details?.data?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const messages = Object.values(validationErrors)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value) => typeof value === 'string' && value.trim())
    if (messages.length) return messages.join(' ')
  }
  return error?.message || 'The poll request failed. Please try again.'
}

export function usePoll() {
  const loading = ref(false)
  const error = ref('')
  const data = ref(null)

  function clearError() {
    error.value = ''
  }

  async function run(action) {
    if (loading.value) return null
    loading.value = true
    error.value = ''
    try {
      const result = await action()
      data.value = result
      return result
    } catch (requestError) {
      error.value = requestErrorMessage(requestError)
      throw requestError
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    data,
    clearError,
    createPoll: (channelId, payload) => run(() => createPollRequest(channelId, payload)),
    submitPollAnswer: (payload) => run(() => submitPollAnswerRequest(payload)),
    getPollQuestions: (queryParams) => run(() => getPollQuestionsRequest(queryParams)),
    getPollResult: (queryParams) => run(() => getPollResultRequest(queryParams)),
    closePoll: (pollId, payload) => run(() => closePollRequest(pollId, payload)),
  }
}