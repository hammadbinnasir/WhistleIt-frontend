import { apiRequest } from '@/lib/api/client'
import { normalizeMessage } from '@/features/dms/dmApi'

const encode = encodeURIComponent

// target = { companyId, teamId?, channelId, messageId }
// teamId ho to team channel ka thread, warna direct message (DM) ka thread
//
// Team channel: /v1/{company}/teams/{team}/channels/{channel}/messages/{message}/replies
// Direct:       /v1/{company}/direct-channels/{channel}/messages/{message}/replies
export function repliesPath({ companyId, teamId, channelId, messageId }) {
  const requiredIds = [companyId, channelId, messageId]
  if (requiredIds.some((id) => id == null || String(id).trim() === '')) {
    throw new Error('Company, channel, and message IDs are required to load replies.')
  }
  if (teamId != null && String(teamId).trim() === '') {
    throw new Error('A team ID is required to load channel replies.')
  }
  const base =
    teamId != null
      ? `/v1/${encode(companyId)}/teams/${encode(teamId)}/channels/${encode(channelId)}`
      : `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}`
  return `${base}/messages/${encode(messageId)}/replies`
}

// ---- validation (sync throw, request se pehle) ----
function requireIds(target = {}, action) {
  if (target.companyId == null || String(target.companyId).trim() === '') {
    throw new Error(`A company ID is required to ${action}.`)
  }
  if (target.channelId == null || String(target.channelId).trim() === '') {
    throw new Error(`A channel ID is required to ${action}.`)
  }
  if (target.messageId == null || String(target.messageId).trim() === '') {
    throw new Error(`A message ID is required to ${action}.`)
  }
  if (target.teamId != null && String(target.teamId).trim() === '') {
    throw new Error(`A team ID is required to ${action} in a channel.`)
  }
}

function unwrapRepliesResponse(response) {
  let data = response
  for (let depth = 0; depth < 6; depth += 1) {
    if (data?.success === false) {
      throw new Error(data.message || 'Unable to load message replies.')
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (Object.hasOwn(data, 'data')) {
        data = data.data
        continue
      }
      if (Object.hasOwn(data, 'result')) {
        data = data.result
        continue
      }
    }
    return data
  }
  throw new Error('The server returned an invalid replies response.')
}

function repliesFrom(data, depth = 0) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object' || depth >= 6) {
    throw new Error('The server returned an invalid replies response.')
  }

  for (const key of ['replies', 'message_replies', 'messageReplies', 'messages', 'items']) {
    if (data[key] !== undefined) return repliesFrom(data[key], depth + 1)
  }
  for (const key of ['data', 'result', 'payload']) {
    if (data[key] !== undefined) return repliesFrom(data[key], depth + 1)
  }
  throw new Error('The server returned an invalid replies response.')
}

function normalizeReply(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The server returned an invalid reply.')
  }
  const id = raw.id ?? raw.reply_id ?? raw.replyId
  if (id == null || String(id).trim() === '') {
    throw new Error('The server returned a reply without an ID.')
  }
  return normalizeMessage({ ...raw, id })
}

function replyFrom(data) {
  let current = data
  for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth += 1) {
    const reply = current.reply ?? current.message_reply ?? current.messageReply ?? current.message
    if (reply && typeof reply === 'object') return reply
    if (current.id != null || current.reply_id != null) return current
    current = current.data ?? current.result ?? current.payload
  }
  return current
}

export const repliesApi = {
  repliesPath,

  // GET .../messages/{message}/replies
  listReplies(target) {
    requireIds(target, 'load replies')
    return apiRequest(repliesPath(target)).then((response) =>
      repliesFrom(unwrapRepliesResponse(response)).map(normalizeReply),
    )
  },

  // POST .../messages/{message}/replies   body: { body: 'text' }
  // Server reply wapas na de (data: null) to null milta hai
  sendReply(target, payload) {
    requireIds(target, 'send a reply')
    return apiRequest(repliesPath(target), {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => {
      const raw = replyFrom(unwrapRepliesResponse(response))
      if (raw == null) return null
      return normalizeReply(raw)
    })
  },
}