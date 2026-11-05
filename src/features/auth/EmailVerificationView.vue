<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { resendVerificationEmail, verifyEmail } from './api'
import authBackground from '@/assets/auth-background.svg'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

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
        <img
          class="brand-mark"
          src="https://app.whistleit.io/img/whistle-logo.8554b9a3.svg"
          alt=""
        />
      </RouterLink>

      <div class="auth-content verification-box">
        <div
          v-if="status === 'loading'"
          class="verification-status"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner :size="52" label="Verifying your email" />
          <header class="auth-heading">
            <h1>Verifying your email</h1>
            <p>Please wait a moment while we confirm your account details...</p>
          </header>
        </div>

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
              :aria-busy="isResending"
            >
              <LoadingSpinner v-if="isResending" :size="20" label="Sending verification email" />
              <template v-else>Send Verification Email</template>
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
      <img class="auth-background" :src="authBackground" alt="" />
    </aside>
  </main>
</template>

<style scoped>
.verification-box {
  width: min(100%, 500px);
}

.verification-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.verification-status > .loading-spinner {
  margin-bottom: 20px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 20px;
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
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  margin-top: 4px;
}

.verification-actions .submit-button,
.retry-button {
  flex: 1 1 180px;
  min-height: 52px;
  margin: 0;
}

.retry-button {
  padding: 0 16px;
  border: 1px solid #d8dced;
  border-radius: 14px;
  background: rgb(255 255 255 / 62%);
  color: #5c57dc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.retry-button:hover {
  border-color: #7772f5;
  background: #fff;
}

.resend-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  margin-top: 20px;
  padding: 18px;
  border: 1px solid rgb(119 114 245 / 16%);
  border-radius: 16px;
  background: rgb(255 255 255 / 52%);
}

.resend-form input {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border: 1px solid #e1e5ef;
  border-radius: 14px;
  outline: none;
  background: #fbfcff;
  color: #17213a;
  font-size: 15px;
}

.resend-form input:focus {
  border-color: #7772f5;
  background: #fff;
  box-shadow: 0 0 0 4px rgb(119 114 245 / 13%);
}

.submit-button--resend {
  min-height: 48px;
  margin: 0;
  font-size: 16px;
}

.verification-box .auth-heading h1 {
  font-size: clamp(30px, 3vw, 38px);
  letter-spacing: -1px;
}

.verification-box .auth-heading p {
  margin: 12px 0 22px;
  font-size: 16px;
}

.verification-box .auth-switch {
  margin-top: 22px;
}

@media (max-width: 760px) {
  .verification-box .auth-heading h1 {
    font-size: clamp(30px, 8vw, 38px);
  }

  .verification-actions {
    flex-direction: column;
  }

  .verification-actions .submit-button,
  .retry-button {
    width: 100%;
    flex-basis: auto;
  }
}
</style>
