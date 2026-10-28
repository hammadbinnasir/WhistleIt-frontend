import { CONVERSATIONS, NOTIFICATIONS, PRESENCE, USERS, ME_ID } from './mockData'

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const clone = (v) => structuredClone(v)

// Backend nahi hai, isliye yeh sirf starting data deta hai.
// Baad mein backend aaye to har function mein http('/...') call lagegi.
export const dmApi = {
  meId: () => ME_ID,
  async users() {
    await delay()
    return clone(USERS)
  },
  async presence() {
    await delay()
    return clone(PRESENCE)
  },
  async conversations() {
    await delay()
    return clone(CONVERSATIONS)
  },
  async notifications() {
    await delay()
    return clone(NOTIFICATIONS)
  },
}
