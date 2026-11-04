import { describe, expect, it } from 'vitest'
import { getAccountErrorToast } from './errorMessages'

describe('account error toast messages', () => {
  it('shows the wrong-current-password toast for an API message', () => {
    expect(getAccountErrorToast(new Error('Wrong current password.'))).toEqual({
      title: 'Error!',
      message: 'Wrong current password.',
    })
  })

  it('recognizes the exact API password-incorrect message', () => {
    expect(getAccountErrorToast(new Error('The password is incorrect.'))).toEqual({
      title: 'Error!',
      message: 'Wrong current password.',
    })
  })

  it('shows the wrong-current-password toast for old-password validation errors', () => {
    expect(
      getAccountErrorToast({
        message: 'The given data was invalid.',
        details: { errors: { old_password: ['The current password is incorrect.'] } },
      }),
    ).toEqual({
      title: 'Error!',
      message: 'Wrong current password.',
    })
  })

  it('preserves the generic account error for other failures', () => {
    expect(getAccountErrorToast(new Error('Profile update failed'))).toEqual({
      title: 'Account error',
      message: 'Profile update failed',
    })
  })
})
