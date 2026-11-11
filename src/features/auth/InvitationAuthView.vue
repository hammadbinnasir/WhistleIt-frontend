<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginViaInvitation, registerViaInvitation } from './api'
import { saveAuthToken } from './session'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import authBackground from '@/assets/auth-background.svg'

const route = useRoute()
const router = useRouter()
const isLogin = ref(false)
const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const acceptedTerms = ref(false)
const feedback = ref('')
const feedbackIsSuccess = ref(false)
const isSubmitting = ref(false)

const token = computed(() => (typeof route.params.token === 'string' ? route.params.token : ''))

function getEmailFromToken(value) {
  const payload = value.split('.')[1]
  if (!payload) return ''

  try {
    const base64Payload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(
      atob(base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=')),
    )
    return typeof decoded.email === 'string' ? decoded.email : ''
  } catch {
    return ''
  }
}

function getInviteEmail() {
  const queryEmail = route.query.email
  if (typeof queryEmail === 'string' && queryEmail.trim()) return queryEmail.trim()
  return getEmailFromToken(token.value)
}

watch(
  () => route.fullPath,
  () => {
    isLogin.value = route.name === 'invitation-login'
    email.value = getInviteEmail()
    fullName.value = ''
    password.value = ''
    confirmPassword.value = ''
    rememberMe.value = false
    showPassword.value = false
    showConfirmPassword.value = false
    acceptedTerms.value = false
    feedback.value = ''
    feedbackIsSuccess.value = false
  },
  { immediate: true },
)

async function submitForm() {
  feedback.value = ''
  feedbackIsSuccess.value = false

  if (!token.value) {
    feedback.value =
      'This invitation link is invalid or has expired. Ask the sender for a new link.'
    return
  }

  if (!email.value.trim()) {
    feedback.value =
      'The invitation link does not include an email address. Enter the email that received the invitation.'
    return
  }

  if (!isLogin.value && password.value.length < 8) {
    feedback.value = 'Passwords must be at least 8 characters long.'
    return
  }

  if (!isLogin.value && password.value !== confirmPassword.value) {
    feedback.value = 'Passwords do not match. Please check them and try again.'
    return
  }

  isSubmitting.value = true
  try {
    if (isLogin.value) {
      const response = await loginViaInvitation(token.value, {
        email: email.value.trim(),
        password: password.value,
        is_remember: rememberMe.value,
      })
      if (!saveAuthToken(response)) {
        throw new Error('Login response did not include an access token.')
      }
      await router.push({ name: 'home' })
      return
    }

    const response = await registerViaInvitation(token.value, {
      name: fullName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      password_confirmation: confirmPassword.value,
      frontend_url: typeof window !== 'undefined' ? window.location.origin : '',
    })
    const accessToken =
      response?.token ??
      response?.access_token ??
      response?.data?.token ??
      response?.data?.access_token
    if (typeof accessToken === 'string' && accessToken.trim()) {
      saveAuthToken(response)
      await router.push({ name: 'home' })
      return
    }

    await router.push({ name: 'login', query: { registered: 'true' } })
  } catch (error) {
    const validationErrors = error?.details?.errors
    const firstValidationError = validationErrors
      ? Object.values(validationErrors)
          .flat()
          .find((message) => typeof message === 'string')
      : null
    feedback.value =
      firstValidationError || error.message || 'Unable to continue. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-page invitation-auth-page" :class="{ 'auth-page--signup': !isLogin }">
    <section class="auth-panel" aria-label="Workspace invitation access">
      <RouterLink class="brand" to="/login" aria-label="Whistle It. home">
        <img
          class="brand-mark"
          src="https://app.whistleit.io/img/whistle-logo.8554b9a3.svg"
          alt=""
        />
      </RouterLink>

      <div class="auth-content">
        <header class="auth-heading">
          <p class="invitation-badge">Workspace invitation</p>
          <h1
            :class="{
              'auth-heading__title--login': isLogin,
            }"
          >
            {{ isLogin ? 'Welcome' : 'Join your workspace' }}
          </h1>
          <p :class="{ 'auth-heading__description--login': isLogin }">
            {{
              isLogin
                ? 'Log in to accept the invitation to your workspace.'
                : 'Create your account to join the workspace that invited you.'
            }}
          </p>
        </header>

        <form class="auth-form" @submit.prevent="submitForm">
          <div v-if="!isLogin">
            <label for="invite-name" class="sr-only"> Full name </label>
            <input
              id="invite-name"
              v-model.trim="fullName"
              name="name"
              type="text"
              autocomplete="name"
              placeholder="Full Name*"
              required
            />
          </div>

          <div>
            <label for="invite-email" class="sr-only"> Email address </label>
            <input
              id="invite-email"
              v-model.trim="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="Email Address*"
              required
            />
            <p class="invitation-email-note">Use the address that received this invitation.</p>
          </div>

          <div>
            <label for="invite-password" class="sr-only">
              {{ isLogin ? 'Password' : 'Create password' }}
            </label>
            <div class="password-field">
              <input
                id="invite-password"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="isLogin ? 'current-password' : 'new-password'"
                :placeholder="isLogin ? 'Password*' : 'Create Password*'"
                minlength="8"
                required
              />
              <button
                class="password-toggle"
                type="button"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <template v-if="showPassword">
                    <path
                      d="M2 12s3.3-7 10-7 10 7 10 7-3.3 7-10 7S2 12 2 12Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    />
                  </template>
                  <path
                    v-else
                    d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5.2 8.5 7s-1.2 3.2-3.1 4.5M6.2 6.2C3.7 7.7 2 10.5 2 12c0 1.8 3.3 7 10 7 1 0 1.9-.2 2.8-.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="!isLogin">
            <label for="invite-confirm-password" class="sr-only"> Confirm password </label>
            <div class="password-field">
              <input
                id="invite-confirm-password"
                v-model="confirmPassword"
                name="password_confirmation"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Confirm Password*"
                minlength="8"
                required
              />
              <button
                class="password-toggle"
                type="button"
                :aria-label="
                  showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                "
                :aria-pressed="showConfirmPassword"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <template v-if="showConfirmPassword">
                    <path
                      d="M2 12s3.3-7 10-7 10 7 10 7-3.3 7-10 7S2 12 2 12Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    />
                  </template>
                  <path
                    v-else
                    d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5.2 8.5 7s-1.2 3.2-3.1 4.5M6.2 6.2C3.7 7.7 2 10.5 2 12c0 1.8 3.3 7 10 7 1 0 1.9-.2 2.8-.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>

          <label v-if="!isLogin" class="terms-row">
            <input v-model="acceptedTerms" name="terms" type="checkbox" required />
            <span>I accept the Terms of use and Privacy Policy.</span>
          </label>

          <label v-if="isLogin" class="remember-row">
            <input v-model="rememberMe" name="rememberMe" type="checkbox" />
            <span>Remember Me</span>
          </label>

          <p
            v-if="feedback"
            class="form-feedback"
            :class="{ 'form-feedback--success': feedbackIsSuccess }"
            role="status"
            aria-live="polite"
          >
            {{ feedback }}
          </p>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="submit-button"
            :class="{
              'submit-button--login': isLogin,
              'submit-button--loading': isSubmitting,
            }"
            :aria-busy="isSubmitting"
          >
            <LoadingSpinner
              v-if="isSubmitting"
              :size="20"
              :label="isLogin ? 'Logging in' : 'Creating account'"
            />
            <template v-else>{{ isLogin ? 'Log in' : 'Sign up' }}</template>
          </button>
        </form>

        <p class="auth-switch">
          <span class="auth-switch__prompt">
            {{ isLogin ? 'New to WhistleIt? ' : 'Already have a WhistleIt account? ' }}
          </span>
          <button
            type="button"
            class="invitation-switch-button"
            @click="
              router.replace({
                name: isLogin ? 'invitation-register' : 'invitation-login',
                params: { token },
                query: route.query,
              })
            "
          >
            {{ isLogin ? 'Sign up' : 'Log in' }}
          </button>
        </p>
      </div>
    </section>

    <aside class="auth-art" aria-hidden="true">
      <img class="auth-background" :src="authBackground" alt="" />
    </aside>
  </main>
</template>

<style scoped>
@media (min-width: 761px) {
  .invitation-auth-page.auth-page--signup .auth-panel {
    padding-top: 20px;
    padding-bottom: 20px;
  }

  .invitation-auth-page.auth-page--signup .auth-content {
    margin-top: auto;
    margin-bottom: auto;
  }

  .invitation-auth-page.auth-page--signup .invitation-badge {
    margin-bottom: 8px;
    padding: 5px 10px;
    font-size: 11px;
  }

  .invitation-auth-page.auth-page--signup .auth-heading h1 {
    font-size: clamp(30px, 2.4vw, 36px);
    letter-spacing: -1px;
  }

  .invitation-auth-page.auth-page--signup .auth-heading > p:not(.invitation-badge) {
    margin: 8px 0 16px;
    color: #66718a;
    font-size: 15px;
    line-height: 1.4;
  }

  .invitation-auth-page.auth-page--signup .auth-form {
    gap: 12px;
  }

  .invitation-auth-page.auth-page--signup .auth-form input:not([type='checkbox']) {
    height: 48px;
  }

  .invitation-auth-page.auth-page--signup .invitation-email-note {
    margin: 3px 0 -9px;
    font-size: 11px;
  }

  .invitation-auth-page.auth-page--signup .terms-row {
    font-size: 14px;
    line-height: 1.4;
  }

  .invitation-auth-page.auth-page--signup .submit-button {
    min-height: 48px;
    margin-top: 0;
  }

  .invitation-auth-page.auth-page--signup .auth-switch {
    margin-top: 12px;
    line-height: 1.3;
  }
}

.invitation-auth-page .auth-art {
  height: 100vh;
  height: 100svh;
  min-height: 100vh;
  min-height: 100svh;
  align-self: start;
}

.invitation-auth-page .auth-form input:not([type='checkbox']) {
  width: 100%;
  height: 58px;
  padding: 0 54px 0 17px;
  border: 1px solid #e1e5ef;
  border-radius: 14px;
  outline: none;
  background: #fbfcff;
  color: #17213a;
  font-size: 16px;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.invitation-auth-page .auth-form input:not([type='checkbox'])::placeholder {
  color: #9aa4b8;
}

.invitation-auth-page .auth-form input:not([type='checkbox']):focus {
  border-color: #7772f5;
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 4px rgb(119 114 245 / 13%);
}

.invitation-badge {
  display: inline-flex;
  margin: 0 0 12px;
  padding: 6px 11px;
  border: 1px solid rgb(92 87 220 / 16%);
  border-radius: 999px;
  background: rgb(255 255 255 / 62%);
  color: #5c57dc;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.invitation-email-note {
  margin: 6px 0 -12px;
  color: #66718a;
  font-size: 12px;
  line-height: 1.4;
}

.invitation-switch-button {
  padding: 0;
  border: 0;
  background: none;
  color: #5c57dc;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.invitation-switch-button:hover {
  text-decoration: underline;
}

.invitation-switch-button:focus-visible {
  outline: 3px solid #928bff;
  outline-offset: 3px;
}

.invitation-auth-page .submit-button:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}
</style>
