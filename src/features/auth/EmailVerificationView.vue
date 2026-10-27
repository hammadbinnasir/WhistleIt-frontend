<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { resendVerificationEmail, verifyEmail } from './api'
import AuthIllustration from './AuthIllustration.vue'

const route = useRoute()
const router = useRouter()

const token = computed(() => {
  const queryToken = route.query.token
  const paramToken = route.params.token
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim()
  if (typeof paramToken === 'string' && paramToken.trim()) return paramToken.trim()
  return ''
})

const status = ref('loading') // 'loading' | 'success' | 'error'
const message = ref('')
const countdown = ref(5)
let countdownTimer = null

const showResend = ref(false)
const resendEmail = ref('')
const isResending = ref(false)
const resendFeedback = ref('')
const resendSuccess = ref(false)

let isVerifying = false
let lastExecutedToken = ''

async function executeVerification() {
  const currentToken = token.value

  if (!currentToken) {
    status.value = 'error'
    message.value =
      'Verification token is missing. Please check your verification link or request a new one.'
    return
  }

  // If already verified in this session or browser tab, show success
  if (sessionStorage.getItem(`verified_token_${currentToken}`)) {
    status.value = 'success'
    message.value = 'Your email address has been verified. You can now log in to Whistle It.'
    startCountdown()
    return
  }

  // Prevent duplicate concurrent requests for the same token
  if (isVerifying || lastExecutedToken === currentToken) {
    return
  }

  isVerifying = true
  lastExecutedToken = currentToken

  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

  status.value = 'loading'
  message.value = ''

  try {
    const response = await verifyEmail(currentToken)
    sessionStorage.setItem(`verified_token_${currentToken}`, 'true')
    status.value = 'success'
    message.value =
      response?.message || 'Your email address has been verified. You can now log in to Whistle It.'
    startCountdown()
  } catch (error) {
    // If the token was previously verified in this session, keep success
    if (sessionStorage.getItem(`verified_token_${currentToken}`)) {
      status.value = 'success'
      message.value = 'Your email address has been verified. You can now log in to Whistle It.'
      startCountdown()
      return
    }

    status.value = 'error'
    const errorDetail = error?.details?.message || error?.message
    message.value =
      errorDetail ||
      'This verification link is invalid, expired, or has already been used. If you have already verified your account, you can proceed to log in.'
  } finally {
    isVerifying = false
  }
}

function startCountdown() {
  countdown.value = 5
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      goToLogin()
    }
  }, 1000)
}

function goToLogin() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  router.push({ name: 'login', query: { verified: 'true' } })
}

async function handleResend() {
  if (!resendEmail.value) return
  isResending.value = true
  resendFeedback.value = ''
  resendSuccess.value = false

  try {
    const res = await resendVerificationEmail(resendEmail.value)
    resendSuccess.value = true
    resendFeedback.value = res?.message || 'Verification link has been sent to your email.'
  } catch (err) {
    resendSuccess.value = false
    resendFeedback.value =
      err?.details?.message ||
      err?.message ||
      'Unable to resend verification link. Please try again.'
  } finally {
    isResending.value = false
  }
}

onMounted(() => {
  executeVerification()
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<template>
  <main class="auth-page auth-page--verification">
    <section class="auth-panel" aria-label="Email verification">
      <RouterLink class="brand" to="/login" aria-label="Whistle It. home">
        <svg class="brand-mark" viewBox="0 0 56 42" aria-hidden="true">
          <path
            d="M5 8.5 15.2 29l8.1-14.4L31 29l8.2-14.8M43.2 11.4l3.1-3.1"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="6.5"
          />
          <circle cx="49.5" cy="7" r="3.5" fill="currentColor" />
        </svg>
        <span>Whistle It.</span>
      </RouterLink>

      <div class="auth-content verification-box">
        <!-- Loading State -->
        <div
          v-if="status === 'loading'"
          class="verification-status"
          role="status"
          aria-live="polite"
        >
          <div class="status-spinner" aria-hidden="true"></div>
          <header class="auth-heading">
            <h1>Verifying your email</h1>
            <p>Please wait a moment while we confirm your account details...</p>
          </header>
        </div>

        <!-- Success State -->
        <div
          v-else-if="status === 'success'"
          class="verification-status"
          role="status"
          aria-live="polite"
        >
          <div class="status-icon status-icon--success" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <header class="auth-heading">
            <h1>Account Verified!</h1>
            <p>{{ message }}</p>
          </header>

          <button class="submit-button" type="button" @click="goToLogin">
            Proceed to Login <span v-if="countdown > 0">({{ countdown }}s)</span>
          </button>
        </div>

        <!-- Error State -->
        <div v-else class="verification-status" role="alert" aria-live="assertive">
          <div class="status-icon status-icon--error" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <header class="auth-heading">
            <h1>Verification Failed</h1>
            <p>{{ message }}</p>
          </header>

          <div class="verification-actions">
            <button class="submit-button" type="button" @click="goToLogin">Go to Login</button>
            <button class="retry-button" type="button" @click="showResend = !showResend">
              {{ showResend ? 'Cancel' : 'Request New Link' }}
            </button>
          </div>

          <!-- Resend Section -->
          <form v-if="showResend" class="resend-form" @submit.prevent="handleResend">
            <label class="sr-only" for="resend-email">Email Address</label>
            <input
              id="resend-email"
              v-model.trim="resendEmail"
              type="email"
              placeholder="Enter your registered email*"
              required
            />
            <p
              v-if="resendFeedback"
              class="form-feedback"
              :class="{ 'form-feedback--success': resendSuccess }"
              role="status"
            >
              {{ resendFeedback }}
            </p>
            <button
              class="submit-button submit-button--resend"
              type="submit"
              :disabled="isResending"
            >
              {{ isResending ? 'Sending...' : 'Send Verification Email' }}
            </button>
          </form>
        </div>

        <p class="auth-switch">
          Already verified?
          <RouterLink to="/login">Log in here</RouterLink>
        </p>
      </div>
    </section>

    <aside class="auth-art" aria-hidden="true">
      <svg class="art-backdrop" viewBox="0 0 800 900" preserveAspectRatio="none">
        <path d="M485 0h315v900H0c170-84 222-236 290-425C362 253 390 82 485 0Z" fill="#302d57" />
        <path
          d="M455 0h30c-95 82-123 253-195 475C222 664 170 816 0 900h-45c188-90 246-247 314-440C340 250 363 79 455 0Z"
          fill="#433e70"
        />
      </svg>
      <AuthIllustration />
    </aside>
  </main>
</template>

<style scoped>
.verification-box {
  display: flex;
  flex-direction: column;
}

.verification-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.status-spinner {
  width: 52px;
  height: 52px;
  margin-bottom: 24px;
  border: 4px solid #ede9fe;
  border-top-color: #5416d7;
  border-radius: 50%;
  animation: spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 24px;
  border-radius: 50%;
}

.status-icon svg {
  width: 32px;
  height: 32px;
}

.status-icon--success {
  background: #ecfdf5;
  color: #10b981;
}

.status-icon--error {
  background: #fef2f2;
  color: #ef4444;
}

.verification-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  margin-top: 12px;
}

.verification-actions .submit-button {
  flex: 1;
  height: 52px;
  margin: 0;
}

.retry-button {
  flex: 1;
  height: 52px;
  padding: 0 16px;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.retry-button:hover {
  background: #f8f7ff;
  border-color: #5416d7;
  color: #5416d7;
}

.resend-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  margin-top: 24px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.resend-form input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 15px;
  outline: none;
}

.resend-form input:focus {
  border-color: #5416d7;
}

.submit-button--resend {
  height: 44px;
  font-size: 15px;
}
</style>
