import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resendVerificationEmail, verifyEmail } from './api'
import EmailVerificationView from './EmailVerificationView.vue'

vi.mock('./api', () => ({
  resendVerificationEmail: vi.fn(),
  verifyEmail: vi.fn(),
}))

async function mountVerificationView(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/verify-email/:token?', name: 'verify-email', component: EmailVerificationView },
      { path: '/login', name: 'login', component: { template: '<main>Login</main>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return {
    router,
    wrapper: mount(EmailVerificationView, { global: { plugins: [router] } }),
  }
}

describe('email verification view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    verifyEmail.mockResolvedValue({ message: 'Email verified.' })
    resendVerificationEmail.mockResolvedValue({ message: 'Verification email sent.' })
  })

  it('shows the shared loading state, verifies the token, and offers login', async () => {
    let finishVerification
    verifyEmail.mockReturnValueOnce(
      new Promise((resolve) => {
        finishVerification = resolve
      }),
    )
    const { wrapper } = await mountVerificationView('/verify-email/verification-token')

    expect(verifyEmail).toHaveBeenCalledWith('verification-token')
    expect(wrapper.get('[aria-label="Verifying your email"]').exists()).toBe(true)
    expect(wrapper.get('.auth-background').attributes('src')).toContain('auth-background.svg')
    expect(wrapper.get('.brand-mark').attributes('src')).toBe(
      'https://app.whistleit.io/img/whistle-logo.8554b9a3.svg',
    )

    finishVerification({ message: 'Email verified.' })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Account Verified!')
    expect(wrapper.text()).toContain('Email verified.')
    expect(wrapper.get('.submit-button').text()).toContain('Proceed to Login')
    wrapper.unmount()
  })

  it('allows the user to request a new verification email after a failure', async () => {
    verifyEmail.mockRejectedValueOnce({
      details: { message: 'Invalid verification token.' },
    })
    const { wrapper } = await mountVerificationView('/verify-email/invalid-token')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Verification Failed')
    expect(wrapper.text()).toContain('Invalid verification token.')

    await wrapper.get('.retry-button').trigger('click')
    await wrapper.get('#resend-email').setValue('sam@example.com')
    await wrapper.get('.resend-form').trigger('submit')
    await flushPromises()

    expect(resendVerificationEmail).toHaveBeenCalledWith('sam@example.com')
    expect(wrapper.text()).toContain('Verification email sent.')
    wrapper.unmount()
  })

  it('reports a missing token without calling the verification API', async () => {
    const { wrapper } = await mountVerificationView('/verify-email')
    await flushPromises()

    expect(verifyEmail).not.toHaveBeenCalled()
    expect(wrapper.get('h1').text()).toBe('Verification Failed')
    expect(wrapper.text()).toContain('Verification token is missing.')
    wrapper.unmount()
  })
})
