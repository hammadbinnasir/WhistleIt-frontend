<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginViaInvitation, registerViaInvitation } from './api'
import { saveAuthToken } from './session'

const route = useRoute()
const router = useRouter()
const isLogin = ref(false)
const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
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
  <main class="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-900">
    <section
      class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"
    >
      <RouterLink
        class="mb-8 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-indigo-700"
        to="/login"
        aria-label="Whistle It. home"
      >
        <svg class="h-7 w-8" viewBox="0 0 56 42" aria-hidden="true">
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
        Whistle It.
      </RouterLink>

      <div class="mb-7">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Company invitation
        </p>
        <h1 class="text-2xl font-bold">{{ isLogin ? 'Welcome back' : 'Join your company' }}</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          {{
            isLogin
              ? 'Log in to accept the invitation to your company.'
              : 'Create your account to join the company that invited you.'
          }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submitForm">
        <div v-if="!isLogin">
          <label for="invite-name" class="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="invite-name"
            v-model.trim="fullName"
            name="name"
            type="text"
            autocomplete="name"
            placeholder="Full name"
            required
            class="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label for="invite-email" class="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="invite-email"
            v-model.trim="email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="name@company.com"
            required
            class="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <p class="mt-1.5 text-xs text-slate-500">
            Use the address that received this invitation.
          </p>
        </div>

        <div>
          <label for="invite-password" class="mb-1.5 block text-sm font-medium text-slate-700">
            {{ isLogin ? 'Password' : 'Create password' }}
          </label>
          <input
            id="invite-password"
            v-model="password"
            name="password"
            type="password"
            :autocomplete="isLogin ? 'current-password' : 'new-password'"
            :placeholder="isLogin ? 'Password' : 'At least 8 characters'"
            minlength="8"
            required
            class="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <div v-if="!isLogin">
          <label
            for="invite-confirm-password"
            class="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Confirm password
          </label>
          <input
            id="invite-confirm-password"
            v-model="confirmPassword"
            name="password_confirmation"
            type="password"
            autocomplete="new-password"
            placeholder="Re-enter your password"
            minlength="8"
            required
            class="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <label v-if="!isLogin" class="flex items-start gap-2 text-xs leading-5 text-slate-600">
          <input
            v-model="acceptedTerms"
            class="mt-1 accent-indigo-600"
            name="terms"
            type="checkbox"
            required
          />
          <span>I accept the Terms of use and Privacy Policy.</span>
        </label>

        <p
          v-if="feedback"
          class="rounded-lg px-3 py-2 text-sm"
          :class="feedbackIsSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
          role="status"
          aria-live="polite"
        >
          {{ feedback }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-60"
        >
          {{
            isSubmitting
              ? 'Please wait...'
              : isLogin
                ? 'Log in and accept invitation'
                : 'Create account'
          }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-600">
        {{ isLogin ? 'New to WhistleIt?' : 'Already have a WhistleIt account?' }}
        <button
          type="button"
          class="font-semibold text-indigo-700 hover:text-indigo-800"
          @click="
            router.replace({
              name: isLogin ? 'invitation-register' : 'invitation-login',
              params: { token },
              query: route.query,
            })
          "
        >
          {{ isLogin ? 'Create account' : 'Log in' }}
        </button>
      </p>
    </section>
  </main>
</template>
