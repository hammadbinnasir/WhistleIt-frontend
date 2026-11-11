import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import { downloadRecentFile, listRecentFiles } from './recentFilesApi'

vi.mock('@/features/channels/api/http', () => ({ http: vi.fn() }))

describe('recent files API', () => {
  beforeEach(() => {
    http.mockReset()
  })

  it('gets recent files with only company_id as a query parameter', async () => {
    const files = [{ id: 'file-1', name: 'report.pdf' }]
    http.mockResolvedValue({ success: true, data: { files } })

    await expect(listRecentFiles('company-1')).resolves.toEqual(files)
    expect(http).toHaveBeenCalledOnce()
    expect(http).toHaveBeenCalledWith('/v1/files/recent', {
      method: 'GET',
      params: { company_id: 'company-1' },
    })
  })

  it('rejects missing company IDs before making a request', async () => {
    await expect(listRecentFiles('')).rejects.toThrow(
      'A company ID is required to load recent files.',
    )
    expect(http).not.toHaveBeenCalled()
  })

  it('reports an invalid response instead of silently showing an empty list', async () => {
    http.mockResolvedValue({ success: true, data: { items: [] } })

    await expect(listRecentFiles('company-1')).rejects.toThrow(
      'The recent files response does not contain a file list.',
    )
  })

  it('downloads the recent file URL and returns a File with its original metadata', async () => {
    const blob = new Blob(['pdf bytes'], { type: 'application/octet-stream' })
    const recentFile = {
      name: 'report.pdf',
      mime_type: 'application/pdf',
      downloadUrl: 'https://files.example.test/report.pdf',
    }
    http.mockResolvedValue(blob)

    const file = await downloadRecentFile(recentFile)

    expect(http).toHaveBeenCalledWith('https://files.example.test/report.pdf', {
      responseType: 'blob',
    })
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('report.pdf')
    expect(file.type).toBe('application/pdf')
    await expect(file.text()).resolves.toBe('pdf bytes')
  })

  it('accepts fileUrl as the source URL for a recent file', async () => {
    http.mockResolvedValue(new Blob(['image bytes'], { type: 'image/jpeg' }))

    await downloadRecentFile({
      fileName: 'photo.jpg',
      fileUrl: 'https://files.example.test/photo.jpg',
    })

    expect(http).toHaveBeenCalledWith('https://files.example.test/photo.jpg', {
      responseType: 'blob',
    })
  })

  it('rejects a recent file that does not contain a download URL', async () => {
    await expect(downloadRecentFile({ name: 'report.pdf' })).rejects.toThrow(
      'This recent file does not have a download URL.',
    )
    expect(http).not.toHaveBeenCalled()
  })
})
