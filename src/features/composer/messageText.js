export function normalizeMessageText(value) {
  const text = String(value ?? '')
  if (!/<\/?p(?:\s|>)/i.test(text)) return text

  const parsed = new DOMParser().parseFromString(text, 'text/html')
  const nodes = [...parsed.body.childNodes]
  const isParagraph = (node) => node.nodeType === Node.ELEMENT_NODE && node.tagName === 'P'
  const paragraphs = nodes.filter(isParagraph)

  if (
    !paragraphs.length ||
    nodes.some(
      (node) =>
        !isParagraph(node) &&
        (node.nodeType !== Node.TEXT_NODE || node.textContent.trim()),
    )
  ) {
    return text
  }

  return paragraphs.map((paragraph) => paragraph.textContent || '').join('\n')
}