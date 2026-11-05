import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repliesApi } from '@/features/replies/repliesApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'

// localStorage: har thread ke replies -> { [company]: { [threadKey]: replies[] } }
export const REPLIES_STORAGE_KEY = 'whistleit:message-replies'
const MAX_CACHED_REPLIES = 200

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error?.message ?? error)
}

const isLocal = (reply) => String(reply.id).startsWith('local-')

// ---- thread key ----
// target = { teamId?, channelId, messageId }
//   DM thread:      "dm:{channel}:{message}"
//   Channel thread: "team:{team}:{channel}:{message}"
// Har hissa encode hota hai taake key se target wapas ban sake (reload ke baad retry ke liye)
export function threadKey({ teamId, channelId, messageId }) {
  const parts = teamId ? ['team', teamId, channelId, messageId] : ['dm', channelId, messageId]
  return parts.map((part, i) => (i ? encodeURIComponent(String(part)) : part)).join(':')
}

export function targetFromKey(key) {
  const [kind, ...rest] = key.split(':')
  const ids = rest.map(decodeURIComponent)
  return kind === 'team'
    ? { teamId: ids[0], channelId: ids[1], messageId: ids[2] }
    : { channelId: ids[0], messageId: ids[1] }
}

// ---- localStorage helpers ----
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(REPLIES_STORAGE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function writeLocal(value) {
  try {
    localStorage.setItem(REPLIES_STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* storage full / blocked: memory mein to rehta hai */
  }
}

export const useRepliesStore = defineStore('replies', () => {
  const teamsStore = useTeamsStore()
  const dms = useDmStore()

  const threads = ref({}) // { [threadKey]: replies[] }
  const loadingByKey = ref({}) // { [threadKey]: boolean }
  const errorByKey = ref({}) // { [threadKey]: string } -> load ka error
  const actionError = ref('') // send ka last error

  const loaded = new Set()
  const requests = new Map()
  // list request chalte waqt jo replies server par save hue (purani list mein nahi honge)
  const sentDuringLoad = new Map()
  let localSeq = 0

  const companyId = computed(() => teamsStore.activeWorkspaceId)

  // ---------- local cache ----------
  function persist(key) {
    const all = readLocal()
    const company = companyId.value
    all[company] = all[company] ?? {}
    all[company][key] = (threads.value[key] ?? []).slice(-MAX_CACHED_REPLIES)
    writeLocal(all)
  }

  // Thread pehli baar khule to saved replies foran dikhao
  function hydrate(key) {
    if (threads.value[key]) return
    const saved = readLocal()[companyId.value]?.[key] ?? []
    // page reload par jo "sending" tha wo ab bheja nahi ja raha: failed dikhao
    threads.value[key] = saved.map((reply) =>
      reply.status === 'sending' ? { ...reply, status: 'failed', error: 'Not sent' } : reply,
    )
  }

  // ---------- getters ----------
  function repliesOf(target) {
    return threads.value[threadKey(target)] ?? []
  }
  function countOf(target, fallback = 0) {
    const list = threads.value[threadKey(target)]
    return list ? list.length : fallback
  }
  function isLoading(target) {
    return Boolean(loadingByKey.value[threadKey(target)])
  }
  function errorOf(target) {
    return errorByKey.value[threadKey(target)] ?? ''
  }
  // API fail hui lekin saved replies dikh rahe hain
  function isOffline(target) {
    return Boolean(errorOf(target)) && repliesOf(target).length > 0
  }

  // ---------- load ----------
  // GET .../messages/{message}/replies
  function loadReplies(target, { force = false } = {}) {
    const key = threadKey(target)
    hydrate(key) // 1) pehle localStorage
    if (!force && loaded.has(key)) return Promise.resolve(true)
    if (requests.has(key)) return requests.get(key)

    const company = companyId.value
    loadingByKey.value[key] = true
    errorByKey.value[key] = ''
    const sentMeanwhile = new Set()
    sentDuringLoad.set(key, sentMeanwhile)

    const request = (async () => {
      try {
        // 2) phir network se taaza replies
        const list = await repliesApi.listReplies({ companyId: company, ...targetFromKey(key) })
        const known = new Set(list.map((reply) => reply.id))
        // API wale replies + wo local/pending jo abhi server par nahi gaye
        // + jo is request ke dauran send hue
        const pending = (threads.value[key] ?? []).filter(
          (reply) =>
            !known.has(reply.id) &&
            ((isLocal(reply) && reply.status !== 'sent') || sentMeanwhile.has(reply.id)),
        )
        threads.value[key] = [...list, ...pending]
        loaded.add(key)
        persist(key)
        return true
      } catch (cause) {
        // cached replies screen par rehte hain, sirf error dikhta hai
        errorByKey.value[key] = errorMessage(cause)
        return false
      } finally {
        loadingByKey.value[key] = false
        requests.delete(key)
        sentDuringLoad.delete(key)
      }
    })()
    requests.set(key, request)
    return request
  }

  // ---------- send ----------
  // POST .../messages/{message}/replies
  async function deliver(key, reply) {
    reply.status = 'sending'
    reply.error = ''
    const localId = reply.id
    try {
      // Backend ko text "body" field mein chahiye (messages ki tarah)
      const saved = await repliesApi.sendReply(
        { companyId: companyId.value, ...targetFromKey(key) },
        { body: reply.text },
      )
      const list = threads.value[key] ?? []
      const index = list.findIndex((r) => r.id === localId)
      if (index === -1) return

      if (!saved) {
        // Server ne reply wapas nahi bheja: list dobara mangwa lo
        // 'sent' wala local reply server list aate hi hat jata hai
        list.splice(index, 1, { ...list[index], status: 'sent', error: '' })
        persist(key)
        await loadReplies(targetFromKey(key), { force: true })
        return
      }
      sentDuringLoad.get(key)?.add(saved.id)
      if (list.some((r) => r.id === saved.id)) {
        list.splice(index, 1) // server list mein pehle se aa chuka
      } else {
        list.splice(index, 1, {
          ...saved,
          from: saved.from || reply.from,
          text: saved.text || reply.text,
          createdAt: saved.createdAt || reply.createdAt,
        })
      }
      persist(key)
    } catch (cause) {
      const current = (threads.value[key] ?? []).find((r) => r.id === localId)
      if (current) {
        current.status = 'failed'
        current.error = errorMessage(cause)
      }
      actionError.value = errorMessage(cause)
      persist(key)
    }
  }

  function sendReply(target, content) {
    const text = String(content ?? '').trim()
    if (!text || !target?.channelId || !target?.messageId) return null

    const key = threadKey(target)
    hydrate(key)
    const reply = {
      id: `local-${Date.now().toString(36)}-${++localSeq}`,
      from: dms.meId,
      text,
      createdAt: new Date().toISOString(),
      parentId: String(target.messageId),
      status: 'sending',
      error: '',
    }
    threads.value[key].push(reply)
    persist(key) // network se pehle hi save, taake reload par bhi na khoye

    const added = threads.value[key].at(-1) // reactive version
    void deliver(key, added)
    return added
  }

  function retryReply(target, replyId) {
    const key = threadKey(target)
    const reply = threads.value[key]?.find((r) => r.id === replyId)
    if (!reply || reply.status !== 'failed') return false
    void deliver(key, reply)
    return true
  }

  // Failed reply chhod dena (server par kabhi gaya hi nahi)
  function discardReply(target, replyId) {
    const key = threadKey(target)
    const list = threads.value[key]
    const index = list?.findIndex((r) => r.id === replyId && isLocal(r)) ?? -1
    if (index === -1) return false
    list.splice(index, 1)
    persist(key)
    return true
  }

  // Internet wapas aaye to failed replies dobara bhejo
  function flushFailed() {
    for (const [key, list] of Object.entries(threads.value)) {
      for (const reply of list) {
        if (reply.status === 'failed') void deliver(key, reply)
      }
    }
  }

  // Logout par call karein taake dusre user ko pichla data na dikhe
  function clearCache() {
    threads.value = {}
    errorByKey.value = {}
    loaded.clear()
    try {
      localStorage.removeItem(REPLIES_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  // ---------- network wapas aaye ----------
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      flushFailed()
      for (const key of Object.keys(threads.value)) {
        if (loaded.has(key) || errorByKey.value[key]) {
          void loadReplies(targetFromKey(key), { force: true })
        }
      }
    })
  }

  return {
    threads,
    actionError,
    repliesOf,
    countOf,
    isLoading,
    errorOf,
    isOffline,
    loadReplies,
    sendReply,
    retryReply,
    discardReply,
    flushFailed,
    clearCache,
  }
})