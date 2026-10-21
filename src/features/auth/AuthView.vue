<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthIllustration from './AuthIllustration.vue'

const route = useRoute()
const isSignup = computed(() => route.path === '/signup')
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

watch(
  () => route.path,
  () => {
    feedback.value = ''
  },
)

function submitForm() {
  feedback.value = ''

  if (!form.value.reportValidity()) return

  if (isSignup.value && password.value !== confirmPassword.value) {
    feedback.value = 'Passwords do not match. Please check them and try again.'
    return
  }

  feedback.value = 'Your form is ready, but account services are not connected yet.'
}

function showPasswordHelp() {
  feedback.value = 'Password reset is not available until account services are connected.'
}
</script>

<template>
  <main class="auth-page" :class="{ 'auth-page--signup': isSignup }">
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
          <h1>{{ isSignup ? 'Create Account' : 'Log in' }}</h1>
          <p>
            {{
              isSignup
                ? 'Fill the form below to create an account'
                : 'Enter your credentials to proceed'
            }}
          </p>
        </header>

        <form ref="form" class="auth-form" @submit.prevent="submitForm">
          <template v-if="isSignup">
            <label class="sr-only" for="full-name">Full Name</label>
            <input
              id="full-name"
              v-model.trim="fullName"
              name="name"
              type="text"
              autocomplete="name"
              placeholder="Full Name*"
              required
            />

            <label class="sr-only" for="company">Company Name</label>
            <input
              id="company"
              v-model.trim="company"
              name="organization"
              type="text"
              autocomplete="organization"
              placeholder="Company Name*"
              required
            />
          </template>

          <label class="sr-only" for="email">Email Address</label>
          <input
            id="email"
            v-model.trim="email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="Email Address*"
            required
          />

          <div class="password-field">
            <label class="sr-only" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isSignup ? 'new-password' : 'current-password'"
              placeholder="Password*"
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

          <div v-if="isSignup" class="password-field">
            <label class="sr-only" for="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              name="confirmPassword"
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

          <div v-else class="login-options">
            <label class="remember-row">
              <input v-model="rememberMe" name="rememberMe" type="checkbox" />
              <span>Remember Me</span>
            </label>
            <button class="text-link" type="button" @click="showPasswordHelp">
              Forgot Password?
            </button>
          </div>

          <p v-if="feedback" class="form-feedback" role="status" aria-live="polite">
            {{ feedback }}
          </p>

          <button class="submit-button" type="submit">
            {{ isSignup ? 'Create Account' : 'Login' }}
          </button>
        </form>

        <p class="auth-switch">
          <template v-if="isSignup">
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
      <svg class="art-backdrop" viewBox="0 0 800 900" preserveAspectRatio="none">
        <path d="M485 0h315v900H0c170-84 222-236 290-425C362 253 390 82 485 0Z" fill="#302d57" />
        <path d="M455 0h30c-95 82-123 253-195 475C222 664 170 816 0 900h-45c188-90 246-247 314-440C340 250 363 79 455 0Z" fill="#433e70" />
      </svg>
      <AuthIllustration />
    </aside>
  </main>
</template>
