// Single switch between the real API and the in-memory mock.
// The rest of the module imports `api` from here and never knows which one it got.
// Defaults to mock so collaborators without .env.local still see data.
import * as real from './channels.api'
import * as mock from './channels.mock'

const api = import.meta.env.VITE_CHANNELS_USE_MOCK !== 'false' ? mock : real
export default api
