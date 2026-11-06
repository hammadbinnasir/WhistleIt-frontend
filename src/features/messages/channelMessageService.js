import { http } from '@/features/channels/api/http'

const COLLECTION_IDS_ERROR = 'Company, team, and channel IDs are required.'
const MESSAGE_IDS_ERROR = 'Company, team, channel, and message IDs are required.'

function encodeIds(ids, errorMessage) {
  if (ids.some((id) => id == null || String(id).trim() === '')) {
    throw new Error(errorMessage)
  }
  return ids.map((id) => encodeURIComponent(String(id)))
}

function collectionPath(companyId, teamId, channelId) {
  const [company, team, channel] = encodeIds([companyId, teamId, channelId], COLLECTION_IDS_ERROR)
  return `/v1/${company}/teams/${team}/channels/${channel}/messages`
}

function messagePath(companyId, teamId, channelId, messageId) {
  const [company, team, channel, message] = encodeIds(
    [companyId, teamId, channelId, messageId],
    MESSAGE_IDS_ERROR,
  )
  return `/v1/${company}/teams/${team}/channels/${channel}/messages/${message}`
}

function assertPayload(payload, { requireContent }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Message payload must be an object.')
  }

  const { content, messageType, parentMessageId } = payload

  if (requireContent && content === undefined) {
    throw new Error('Message content is required.')
  }
  if (content !== undefined && (typeof content !== 'string' || !content.trim())) {
    throw new Error('Message content must be a non-empty string.')
  }
  if (messageType !== undefined && typeof messageType !== 'string') {
    throw new Error('Message type must be a string.')
  }
  if (parentMessageId != null && typeof parentMessageId !== 'string') {
    throw new Error('Parent message ID must be a string or null.')
  }
  if (!requireContent && Object.keys(payload).length === 0) {
    throw new Error('At least one field is required to update a message.')
  }
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'The channel message request failed.'
}

/**
 * Single try/catch boundary: path building, payload validation, and the
 * network call all run inside it, so every exported function always resolves
 * with a standardized result and never throws.
 * `build` returns [path] or [path, options].
 */
async function request(build) {
  try {
    const [path, options] = build()
    const data = options === undefined ? await http(path) : await http(path, options)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}

/**
 * @typedef {Object} ChannelMessagePayload
 * @property {string} content
 * @property {string} [messageType]
 * @property {string|null} [parentMessageId]
 */

/**
 * @typedef {Object} ServiceResult
 * @property {boolean} success
 * @property {unknown} [data]
 * @property {string} [error]
 */

/**
 * GET /v1/{company}/teams/{team}/channels/{channel}/messages
 * @param {string|number} companyId
 * @param {string|number} teamId
 * @param {string|number} channelId
 * @param {{page?: number, perPage?: number}} options
 * @returns {Promise<ServiceResult>}
 */
export function getChannelMessages(
  companyId,
  teamId,
  channelId,
  { page = 1, perPage = 15 } = {},
) {
  return request(() => [
    collectionPath(companyId, teamId, channelId),
    { params: { include_deleted: true, page, per_page: perPage } },
  ])
}

/**
 * GET /v1/{company}/teams/{team}/channels/{channel}/messages/{message}
 * @param {string|number} companyId
 * @param {string|number} teamId
 * @param {string|number} channelId
 * @param {string|number} messageId
 * @returns {Promise<ServiceResult>}
 */
export function getChannelMessage(companyId, teamId, channelId, messageId) {
  return request(() => [messagePath(companyId, teamId, channelId, messageId)])
}

/**
 * POST /v1/{company}/teams/{team}/channels/{channel}/messages
 * @param {string|number} companyId
 * @param {string|number} teamId
 * @param {string|number} channelId
 * @param {ChannelMessagePayload} payload
 * @returns {Promise<ServiceResult>}
 */
export function sendChannelMessage(companyId, teamId, channelId, payload) {
  return request(() => {
    const path = collectionPath(companyId, teamId, channelId)
    assertPayload(payload, { requireContent: true })
    const { content, ...metadata } = payload
    return [path, { method: 'POST', body: { ...metadata, body: content.trim() } }]
  })
}

/**
 * PATCH /v1/{company}/teams/{team}/channels/{channel}/messages/{message}
 * @param {string|number} companyId
 * @param {string|number} teamId
 * @param {string|number} channelId
 * @param {string|number} messageId
 * @param {Partial<ChannelMessagePayload>} payload
 * @returns {Promise<ServiceResult>}
 */
export function updateChannelMessage(companyId, teamId, channelId, messageId, payload) {
  return request(() => {
    const path = messagePath(companyId, teamId, channelId, messageId)
    assertPayload(payload, { requireContent: false })
    const { content, ...metadata } = payload
    const body = content === undefined ? metadata : { ...metadata, body: content.trim() }
    return [path, { method: 'PATCH', body }]
  })
}

/**
 * PATCH /v1/{company}/teams/{team}/channels/{channel}/messages/{message}
 * Soft-deletes the message so channel members can see its deleted placeholder.
 * @param {string|number} companyId
 * @param {string|number} teamId
 * @param {string|number} channelId
 * @param {string|number} messageId
 * @returns {Promise<ServiceResult>}
 */
export function deleteChannelMessage(companyId, teamId, channelId, messageId) {
  return request(() => [
    messagePath(companyId, teamId, channelId, messageId),
    { method: 'PATCH', body: { is_deleted: true } },
  ])
}