import { apiRequest } from '@/lib/api/client'
import { parseReactions, reactionsOf, unwrap } from '@/features/dms/dmApi'

const encode = encodeURIComponent

// Backend emoji ko is field mein leta hai: { "reaction": "👍" }
// Agar backend ka field naam alag ho (jaise "reaction") to sirf yahan badlein
export const REACTION_FIELD = 'reaction'

// target = { companyId, teamId?, channelId, messageId }
// teamId ho to team channel, warna direct message (DM)
//
// Team channel: /v1/{company}/teams/{team}/channels/{channel}/messages/{message}/reactions
// Direct:       /v1/{company}/direct-channels/{channel}/messages/{message}/reactions
export function reactionsPath({ companyId, teamId, channelId, messageId }) {
  const base = teamId
    ? `/v1/${encode(companyId)}/teams/${encode(teamId)}/channels/${encode(channelId)}`
    : `/v1/${encode(companyId)}/direct-channels/${encode(channelId)}`
  return `${base}/messages/${encode(messageId)}/reactions`
}

function requireIds(target = {}) {
  if (!target.companyId) throw new Error('A company ID is required to react to a message.')
  if (!target.channelId) throw new Error('A channel ID is required to react to a message.')
  if (!target.messageId) throw new Error('A message ID is required to react to a message.')
}

// Server jawab mein message ke saare reactions de to wo lo, warna null (screen wale hi rahenge).
// Sirf ek reaction ki row ({ id, reaction, user_id }) ya { action: 'added' } aaye to bhi null.
function reactionsFrom(data) {
  if (Array.isArray(data)) return parseReactions(data)
  // Backend: data: { "message-reaction": { reactions: [...] } }
  const list =
    reactionsOf(data) ??
    reactionsOf(data?.message) ??
    reactionsOf(data?.direct_message) ??
    reactionsOf(data?.data)
  return parseReactions(list)
}

export const reactionsApi = {
  reactionsPath,

  // POST .../messages/{message}/reactions   (ek hi call: add bhi, remove bhi)
  toggleReaction(target, emoji) {
    requireIds(target)
    if (!emoji) throw new Error('An emoji is required to react to a message.')
    return apiRequest(reactionsPath(target), {
      method: 'POST',
      body: JSON.stringify({ [REACTION_FIELD]: emoji }),
    }).then((response) => reactionsFrom(unwrap(response)))
  },
}