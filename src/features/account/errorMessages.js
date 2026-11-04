export function getAccountErrorToast(error) {
  const validationErrors = error?.details?.errors ?? {}
  const oldPasswordErrors = validationErrors.old_password ?? validationErrors.current_password
  const passwordErrorText = [
    error?.message,
    ...(Array.isArray(oldPasswordErrors) ? oldPasswordErrors : [oldPasswordErrors]),
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')

  const isWrongCurrentPassword =
    /\b(?:wrong|incorrect|invalid)\b.{0,40}\b(?:current|old)\s+password\b|\b(?:current|old)\s+password\b.{0,40}\b(?:wrong|incorrect|invalid|does not match|doesn't match)\b/i.test(
      passwordErrorText,
    )
  const isIncorrectPassword =
    /\bpassword\b.{0,40}\b(?:wrong|incorrect|invalid)\b/i.test(passwordErrorText)

  if (isWrongCurrentPassword || isIncorrectPassword) {
    return { title: 'Error!', message: 'Wrong current password.' }
  }

  return {
    title: 'Account error',
    message: error?.message || 'The account request failed.',
  }
}
