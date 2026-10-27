import { describe, expect, it } from 'vitest'

import { allHelpPages, helpPages, shortcutColumns, whatsNewPage } from './helpContent'
import { buildSearchIndex, searchHelp } from './helpSearch'

describe('help content', () => {
  it("has the four topics and What's New with all their articles", () => {
    expect(helpPages.map((page) => page.title)).toEqual([
      'Features',
      'Understand direct messages',
      'Problem with notification',
      'Use mention at Whistleit',
    ])
    expect(helpPages[0].sections).toHaveLength(18)
    expect(whatsNewPage.sections).toHaveLength(8)
  })

  it('gives every article a unique id (ids are the image file names and scroll targets)', () => {
    const ids = allHelpPages.flatMap((page) => page.sections.map((section) => section.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every article a title and something to show', () => {
    for (const page of allHelpPages) {
      for (const section of page.sections) {
        expect(section.title).toBeTruthy()
        expect(section.text || section.bullets || section.steps).toBeTruthy()
      }
    }
  })

  it('lists every shortcut with at least one key', () => {
    for (const column of shortcutColumns) {
      for (const group of column.groups) {
        for (const item of group.items) {
          expect(item.keys.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('searchHelp', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(searchHelp('')).toEqual([])
    expect(searchHelp('   ')).toEqual([])
  })

  it('finds articles by any word in their title, ignoring case and order', () => {
    const titles = searchHelp('TIMER mute').map((entry) => entry.title)
    expect(titles).toEqual(['Mute channel with timer', 'Mute channel with timer'])
  })

  it('tells same-named articles apart by the page they are on', () => {
    const labels = searchHelp('add status').map((entry) => entry.label)
    expect(labels).toEqual(['Features', "What's New"])
  })

  it('points an article result at its page and section', () => {
    const [entry] = searchHelp('seamless communication')
    expect(entry).toMatchObject({ pageId: 'features', sectionId: 'features-1' })
  })

  it('finds the topic pages themselves', () => {
    const entry = searchHelp('understand direct').find((e) => e.sectionId === null)
    expect(entry).toMatchObject({ pageId: 'direct-messages', label: 'Help topic' })
  })

  it('finds the shortcuts dialog', () => {
    const [entry] = searchHelp('keyboard')
    expect(entry).toMatchObject({ action: 'shortcuts' })
  })

  it('returns nothing when no title matches', () => {
    expect(searchHelp('zzzz')).toEqual([])
  })

  it('indexes every article once', () => {
    const articleCount = allHelpPages.reduce((sum, page) => sum + page.sections.length, 0)
    const index = buildSearchIndex()
    // every article + one entry per page + the shortcuts dialog
    expect(index).toHaveLength(articleCount + allHelpPages.length + 1)
  })
})
