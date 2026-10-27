<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { login, register, requestPasswordReset, resetPassword } from './api'
import { saveAuthToken } from './session'
import authBackground from '@/assets/auth-background.svg'

const route = useRoute()
const router = useRouter()
const isSignup = computed(() => route.path === '/signup')
const isForgotPassword = computed(() => route.path === '/forgot-password')
const isResetPassword = computed(() => route.path === '/reset-password')
const resetToken = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const form = ref(null)
const fullName = ref('')
const company = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const rememberMe = ref(false)
const acceptedTerms = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const feedback = ref('')
const feedbackIsSuccess = ref(false)
const isSubmitting = ref(false)

watch(
  () => route.fullPath,
  () => {
    fullName.value = ''
    company.value = ''
    email.value =
      isResetPassword.value && typeof route.query.email === 'string' ? route.query.email : ''
    password.value = ''
    confirmPassword.value = ''
    rememberMe.value = false
    acceptedTerms.value = false
    showPassword.value = false
    showConfirmPassword.value = false
    if (route.query.verified === 'true') {
      feedback.value = 'Your email has been verified successfully! You can now log in.'
      feedbackIsSuccess.value = true
    } else if (route.query.registered === 'true') {
      feedback.value =
        'Account created successfully! Please check your email inbox to verify your account.'
      feedbackIsSuccess.value = true
    } else {
      feedback.value = ''
      feedbackIsSuccess.value = false
    }
  },
  { immediate: true },
)

async function submitForm() {
  feedback.value = ''
  feedbackIsSuccess.value = false

  if (!form.value.reportValidity()) return

  if (
    (isSignup.value || isResetPassword.value) &&
    (password.value.length < 8 || confirmPassword.value.length < 8)
  ) {
    feedback.value = 'Passwords must be at least 8 characters long.'
    return
  }

  if ((isSignup.value || isResetPassword.value) && password.value !== confirmPassword.value) {
    feedback.value = 'Passwords do not match. Please check them and try again.'
    return
  }

  if (isResetPassword.value && !resetToken.value) {
    feedback.value = 'This password reset link is invalid or has expired. Request a new one.'
    return
  }

  isSubmitting.value = true
  try {
    if (isForgotPassword.value) {
      await requestPasswordReset(email.value)
      feedback.value =
        'If an account exists for this email, password reset instructions will be sent.'
      feedbackIsSuccess.value = true
      return
    }

    if (isResetPassword.value) {
      await resetPassword({
        email: email.value,
        token: resetToken.value,
        password: password.value,
        password_confirmation: confirmPassword.value,
      })
      feedback.value = 'Your password has been reset. You can now log in.'
      feedbackIsSuccess.value = true
      return
    }

    const response = isSignup.value
      ? await register({
          name: fullName.value,
          company: company.value,
          email: email.value,
          password: password.value,
          password_confirmation: confirmPassword.value,
        })
      : await login({ email: email.value, password: password.value })

    if (isSignup.value) {
      await router.push({ name: 'login', query: { registered: 'true' } })
    } else {
      if (!saveAuthToken(response, rememberMe.value)) {
        throw new Error('Login response did not include an access token.')
      }
      const redirect = route.query.redirect
      const destination =
        typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : { name: 'home' }
      await router.push(destination)
    }
  } catch (error) {
    const validationErrors = error?.details?.errors
    const firstValidationError = validationErrors
      ? Object.values(validationErrors)
          .flat()
          .find((message) => typeof message === 'string')
      : null
    feedback.value =
      firstValidationError || error.message || 'Unable to authenticate. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main
    class="auth-page"
    :class="{ 'auth-page--signup': isSignup, 'auth-page--forgot-password': isForgotPassword }"
  >
    <section class="auth-panel" aria-label="Account access">
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

      <div class="auth-content">
        <header class="auth-heading">
          <h1>
            {{
              isSignup
                ? 'Create Account'
                : isForgotPassword
                  ? 'Reset Password'
                  : isResetPassword
                    ? 'Reset Password'
                    : 'Log in'
            }}
          </h1>
          <p>
            {{
              isSignup
                ? 'Fill the form below to create an account'
                : isForgotPassword
                  ? "Enter the email associated with your account and we'll send an email with instructions to reset your password"
                  : isResetPassword
                    ? 'Choose a new password for your account.'
                    : 'Enter your credentials to proceed'
            }}
          </p>
        </header>

        <form
          ref="form"
          class="auth-form"
          :autocomplete="isSignup ? 'off' : 'on'"
          @submit.prevent="submitForm"
        >
          <template v-if="isSignup">
            <label class="sr-only" for="full-name">Full Name</label>
            <input
              id="full-name"
              v-model.trim="fullName"
              name="name"
              type="text"
              autocomplete="off"
              placeholder="Full Name*"
              required
            />

            <label class="sr-only" for="company">Company Name</label>
            <input
              id="company"
              v-model.trim="company"
              name="company"
              type="text"
              autocomplete="off"
              placeholder="Company Name*"
              required
            />
          </template>

          <label class="sr-only" for="email">Email Address</label>
          <input
            id="email"
            v-model.trim="email"
            :name="
              isSignup
                ? 'new-account-email'
                : isForgotPassword
                  ? 'reset-email'
                  : isResetPassword
                    ? 'reset-email'
                    : 'username'
            "
            type="email"
            :autocomplete="
              isSignup ? 'off' : isForgotPassword || isResetPassword ? 'email' : 'username'
            "
            placeholder="Email Address*"
            required
          />

          <div v-if="!isForgotPassword" class="password-field">
            <label class="sr-only" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              :name="isSignup || isResetPassword ? 'new-password' : 'password'"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isSignup || isResetPassword ? 'new-password' : 'current-password'"
              :placeholder="isResetPassword ? 'New Password*' : 'Password*'"
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
                <path
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

          <div v-if="isSignup || isResetPassword" class="password-field">
            <label class="sr-only" for="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              name="new-password-confirm"
              :type="showConfirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Confirm Password*"
              minlength="8"
              required
            />
            <button
              class="password-toggle"
              type="button"
              :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
              :aria-pressed="showConfirmPassword"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
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

          <div v-if="isSignup" class="terms-row">
            <input id="terms" v-model="acceptedTerms" name="terms" type="checkbox" required />
            <label for="terms">
              I accept to the <a href="#terms" @click.prevent>Terms of use</a> and
              <a href="#privacy" @click.prevent>Privacy Policy</a>.
            </label>
          </div>

          <div v-else-if="!isForgotPassword && !isResetPassword" class="login-options">
            <label class="remember-row">
              <input v-model="rememberMe" name="rememberMe" type="checkbox" />
              <span>Remember Me</span>
            </label>
            <RouterLink class="text-link" to="/forgot-password"> Forgot Password? </RouterLink>
          </div>

          <button class="submit-button" type="submit" :disabled="isSubmitting">
            {{
              isSubmitting
                ? 'Please wait...'
                : isSignup
                  ? 'Create Account'
                  : isForgotPassword
                    ? 'Send Instructions'
                    : isResetPassword
                      ? 'Reset Password'
                      : 'Login'
            }}
          </button>

          <p
            v-if="feedback"
            class="form-feedback"
            :class="{ 'form-feedback--success': feedbackIsSuccess }"
            role="status"
            aria-live="polite"
          >
            {{ feedback }}
          </p>
        </form>

        <p class="auth-switch">
          <template v-if="isForgotPassword">
            <RouterLink to="/login">Back to Login</RouterLink>
          </template>
          <template v-else-if="isResetPassword">
            Need another reset link?
            <RouterLink to="/forgot-password">Request one</RouterLink>
          </template>
          <template v-else-if="isSignup">
            Already have an account?
            <RouterLink to="/login">Login</RouterLink>
          </template>
          <template v-else>
            Don't have an account?
            <RouterLink to="/signup">Sign Up?</RouterLink>
          </template>
        </p>
      </div>
    </section>

    <aside class="auth-art" aria-hidden="true">
      <img class="auth-background" :src="authBackground" alt="" />
    </aside>
  </main>
</template>
