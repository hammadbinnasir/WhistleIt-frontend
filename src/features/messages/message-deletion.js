const MAX_TIMEOUT = 2_147_483_647

export function redactMessage(message) {
  message.deleted = true
  message.deletedAt = new Date().toISOString()
  message.content = ''
  message.text = ''
  message.reactions = []

  for (const field of [
    'attachments',
    'forwardedFrom',
    'replyTo',
    'important',
    'gif',
    'deleteScheduledAt',
  ]) {
    delete message[field]
  }
}

export function createMessageDeletionScheduler(onDelete) {
  const timers = new Map()

  function cancel(key) {
    const timer = timers.get(key)
    if (timer) clearTimeout(timer)
    timers.delete(key)
  }

  function schedule(key, message) {
    cancel(key)
    const deadline = Date.parse(message.deleteScheduledAt)
    if (!Number.isFinite(deadline)) return false

    if (deadline <= Date.now()) {
      redactMessage(message)
      onDelete(message)
      return true
    }

    const timer = setTimeout(() => {
      timers.delete(key)
      if (message.deleted || Date.parse(message.deleteScheduledAt) !== deadline) return
      if (Date.now() < deadline) {
        schedule(key, message)
        return
      }
      redactMessage(message)
      onDelete(message)
    }, Math.min(deadline - Date.now(), MAX_TIMEOUT))
    timer.unref?.()
    timers.set(key, timer)
    return true
  }

  return { schedule, cancel }
}