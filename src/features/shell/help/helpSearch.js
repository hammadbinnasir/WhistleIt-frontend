import { allHelpPages } from './helpContent'

// The search box in the Help drawer looks through every article title:
// the topic pages, each article inside them, What's New items and the shortcuts dialog.
// Each entry says where to go: a page (and optionally the article to scroll to) or the dialog.

export function buildSearchIndex(pages = allHelpPages) {
  const entries = []

  for (const page of pages) {
    entries.push({
      key: page.id,
      title: page.title,
      label: 'Help topic',
      pageId: page.id,
      sectionId: null,
    })

    for (const section of page.sections) {
      entries.push({
        key: section.id,
        title: section.title,
        label: page.title,
        pageId: page.id,
        sectionId: section.id,
      })
    }
  }

  entries.push({
    key: 'shortcuts',
    title: 'Keyboard Shortcuts',
    label: 'Shortcuts',
    action: 'shortcuts',
  })

  return entries
}

export const searchIndex = buildSearchIndex()

// Case-insensitive. Every word typed has to appear in the title, in any order.
export function searchHelp(query, index = searchIndex) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  return index.filter((entry) => {
    const title = entry.title.toLowerCase()
    return words.every((word) => title.includes(word))
  })
}
