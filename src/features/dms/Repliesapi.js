import { apiRequest } from '@/lib/api/client'
import { normalizeMessage, unwrap } from '@/features/dms/dmApi'

const encode = encodeURIComponent

// target = { companyId, teamId?, channelId, messageId }
// teamId ho to team channel ka thread, warna direct message (DM) ka thread
//
// Team channel: /v1/{company}/teams/{team}/channels/{channel}/messages/{message}/replies
// Direct:       /v1/{company}/direct-channels/{channel}/messages/{message}/replies
export function repliesPath({ companyId, teamId, channelId, messageId }) {
  const base = teamId
    ? `/v1/${encode(companyId)}/teams/${encode(teamId)}/channels/${encode(channelId)}`
    : `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}`
  return `${base}/messages/${encode(messageId)}/replies`
}

// ---- validation (sync throw, request se pehle) ----
function requireIds(target = {}, action) {
  if (!target.companyId) throw new Error(`A company ID is required to ${action}.`)
  if (!target.channelId) throw new Error(`A channel ID is required to ${action}.`)
  if (!target.messageId) throw new Error(`A message ID is required to ${action}.`)
}

// Backend ka exact shape alag ho sakta hai, isliye kai jagah se dhoondte hain
function repliesFrom(data) {
  const list = Array.isArray(data)
    ? data
    : (data?.replies ?? data?.message_replies ?? data?.messages ?? [])
  return Array.isArray(list) ? list : []
}

function replyFrom(data) {
  return data?.reply ?? data?.message_reply ?? data?.message ?? data
}

export const repliesApi = {
  repliesPath,

  // GET .../messages/{message}/replies
  listReplies(target) {
    requireIds(target, 'load replies')
    return apiRequest(repliesPath(target)).then((response) =>
      repliesFrom(unwrap(response)).map(normalizeMessage),
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
      const raw = replyFrom(unwrap(response))
      return raw && typeof raw === 'object' && raw.id != null ? normalizeMessage(raw) : null
    })
  },
}