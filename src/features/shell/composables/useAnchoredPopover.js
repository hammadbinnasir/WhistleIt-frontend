import { nextTick, onBeforeUnmount, watch } from 'vue'

const VIEWPORT_PADDING = 8

export function useAnchoredPopover({
  isOpen,
  triggerRef,
  popoverRef,
  position,
  placement = 'right-start',
  offset = 8,
  onClose,
  onRestoreFocus,
}) {
  function updatePosition() {
    const trigger = triggerRef.value
    const popover = popoverRef.value
    if (!trigger || !popover) return

    popover.style.maxWidth = `calc(100vw - ${VIEWPORT_PADDING * 2}px)`
    popover.style.maxHeight = `calc(100vh - ${VIEWPORT_PADDING * 2}px)`
    const triggerBounds = trigger.getBoundingClientRect()
    let popoverBounds = popover.getBoundingClientRect()
    let popoverWidth
    let left
    let top

    if (placement === 'bottom-start') {
      popoverWidth = Math.min(popoverBounds.width, window.innerWidth - VIEWPORT_PADDING * 2)
      const popoverHeight = Math.min(
        popoverBounds.height,
        window.innerHeight - VIEWPORT_PADDING * 2,
      )
      left = triggerBounds.left
      top = triggerBounds.bottom + offset
      if (top + popoverHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = triggerBounds.top - popoverHeight - offset
      }
      if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING
    } else {
      const rightRoom = window.innerWidth - triggerBounds.right - offset - VIEWPORT_PADDING
      const leftRoom = triggerBounds.left - offset - VIEWPORT_PADDING
      if (popoverBounds.width > rightRoom && rightRoom >= leftRoom) {
        popover.style.maxWidth = `${Math.max(0, rightRoom)}px`
      } else if (popoverBounds.width > leftRoom && leftRoom > rightRoom) {
        popover.style.maxWidth = `${Math.max(0, leftRoom)}px`
      }
      popoverBounds = popover.getBoundingClientRect()
      popoverWidth = Math.min(popoverBounds.width, window.innerWidth - VIEWPORT_PADDING * 2)
      const popoverHeight = Math.min(
        popoverBounds.height,
        window.innerHeight - VIEWPORT_PADDING * 2,
      )
      left = triggerBounds.right + offset
      if (rightRoom < leftRoom && left + popoverWidth > window.innerWidth - VIEWPORT_PADDING) {
        left = triggerBounds.left - popoverWidth - offset
      }
      left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - popoverWidth - VIEWPORT_PADDING),
      )
      top = Math.max(
        VIEWPORT_PADDING,
        Math.min(triggerBounds.top, window.innerHeight - popoverHeight - VIEWPORT_PADDING),
      )
    }

    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - popoverWidth - VIEWPORT_PADDING),
    )
    position.value = { left: `${left}px`, top: `${top}px` }
  }

  function close(restoreFocus = false) {
    onClose()
    if (restoreFocus) {
      nextTick(() => {
        if (onRestoreFocus) onRestoreFocus()
        else triggerRef.value?.focus()
      })
    }
  }

  function handleOutsidePointer(event) {
    if (!triggerRef.value?.contains(event.target) && !popoverRef.value?.contains(event.target)) {
      close()
    }
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    close(true)
  }

  function stopListening() {
    document.removeEventListener('pointerdown', handleOutsidePointer)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  }

  watch(
    isOpen,
    async (open) => {
      stopListening()
      if (!open) return
      await nextTick()
      updatePosition()
      document.addEventListener('pointerdown', handleOutsidePointer)
      document.addEventListener('keydown', handleKeydown)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    },
    { flush: 'post', immediate: true },
  )

  onBeforeUnmount(stopListening)

  return { updatePosition, close }
}
