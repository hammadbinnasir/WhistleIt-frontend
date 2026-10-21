// Central API client. NO component should call fetch() directly.
// Owner: Auth (token attach + refresh) with App shell lead. Stub for now.
const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    // One error shape for the whole UI (to be agreed with backend).
    throw { status: res.status, message: res.statusText }
  }
  return res.json()
}
