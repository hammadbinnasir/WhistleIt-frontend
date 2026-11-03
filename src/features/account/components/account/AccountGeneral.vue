<script setup>
import { reactive, ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  profile: { type: Object, default: () => ({}) },
})

const defaults = {
  fullName: '',
  alias: '',
  twoFactor: 'inactive',
  designation: '',
  jobResponsibilities: [],
}

const normalizeResponsibilities = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string')
    : typeof value === 'string'
      ? value
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      : []

const general = reactive(
  Object.fromEntries(
    Object.keys(defaults).map((key) => [
      key,
      key === 'jobResponsibilities'
        ? normalizeResponsibilities(props.profile[key] ?? defaults[key])
        : (props.profile[key] ?? defaults[key]),
    ]),
  ),
)

const fields = [
  { key: 'fullName', label: 'Full name', placeholder: 'Full name' },
  { key: 'alias', label: 'Alias', placeholder: 'Alias' },
  {
    key: 'twoFactor',
    label: 'Two-Factor Authentication',
    type: 'select',
    options: [
      { value: 'inactive', label: 'Inactive' },
      { value: 'active', label: 'Active' },
    ],
  },
  { key: 'designation', label: 'Designation', placeholder: 'Enter Designation' },
  {
    key: 'jobResponsibilities',
    label: 'Job Responsibilities',
    placeholder: 'Enter Job Responsibilities',
  },
]

const initials = computed(() =>
  general.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join(''),
)

/* ---------- photo ---------- */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/gif', 'image/png']

const fileInput = ref(null)
const responsibilityInput = ref('')
const responsibilityInputEl = ref(null)
const responsibilitiesFocused = ref(false)
const photoFile = ref(null)
const photoUrl = ref(props.profile.photoUrl || '')
const photoError = ref('')
const photoRemoved = ref(false)

const revokePreview = () => {
  if (photoFile.value && photoUrl.value) URL.revokeObjectURL(photoUrl.value)
}

const onPhotoChange = (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    photoError.value = 'Please upload a JPEG, JPG, GIF or PNG image.'
    return
  }
  if (file.size > MAX_PHOTO_BYTES) {
    photoError.value = 'File is larger than 2 MB.'
    return
  }

  photoError.value = ''
  revokePreview()
  photoFile.value = file
  photoRemoved.value = false
  photoUrl.value = URL.createObjectURL(file)
}

const removePhoto = () => {
  revokePreview()
  photoFile.value = null
  photoUrl.value = ''
  photoRemoved.value = true
  photoError.value = ''
}

onBeforeUnmount(revokePreview)

/* ---------- validation ---------- */
const submitted = ref(false)

const getJobResponsibilities = () => general.jobResponsibilities

const errors = computed(() => {
  if (!submitted.value) return {}
  const validationErrors = {}
  if (!general.fullName.trim()) validationErrors.fullName = 'Required.'
  return validationErrors
})

const addJobResponsibility = () => {
  const responsibility = responsibilityInput.value.trim()
  if (!responsibility) return
  if (general.jobResponsibilities.length >= 5) return
  if (
    general.jobResponsibilities.some(
      (item) => item.toLocaleLowerCase() === responsibility.toLocaleLowerCase(),
    )
  ) {
    responsibilityInput.value = ''
    return
  }
  general.jobResponsibilities.push(responsibility)
  responsibilityInput.value = ''
}

const removeJobResponsibility = (index) => {
  general.jobResponsibilities.splice(index, 1)
}

const validate = () => {
  submitted.value = true
  return Object.keys(errors.value).length === 0
}

const getValues = () => ({
  profile: {
    ...general,
    fullName: general.fullName.trim(),
    jobResponsibilities: getJobResponsibilities(),
  },
  photo: photoFile.value,
  removePhoto: photoRemoved.value,
  photoAction: photoFile.value ? 'added' : photoRemoved.value ? 'removed' : null,
})

defineExpose({ validate, getValues })
</script>

<template>
  <div class="general">
    <h4 class="profile-heading">Profile Picture</h4>

    <div class="profile-row">
      <div class="avatar">
        <img v-if="photoUrl" :src="photoUrl" alt="Profile picture" />
        <span v-else>{{ initials }}</span>
      </div>

      <div class="upload-info">
        <p>Upload a picture in <b>JPEG, JPG, GIF</b> or <b>PNG</b> format.</p>
        <p>Maximum file size: <b>2 MB</b></p>
        <button type="button" class="upload-btn" @click="fileInput.click()">UPLOAD PHOTO</button>
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/gif,image/png"
          hidden
          @change="onPhotoChange"
        />
        <button v-if="photoUrl" type="button" class="remove-btn" @click="removePhoto">
          REMOVE PHOTO
        </button>
        <p v-if="photoError" class="photo-error">{{ photoError }}</p>
      </div>
    </div>

    <div class="fields">
      <div
        v-for="field in fields"
        :key="field.key"
        class="field"
        :class="{
          invalid: errors[field.key],
          'multiline-field': field.key === 'jobResponsibilities',
        }"
      >
        <template v-if="field.type === 'select'">
          <select v-model="general[field.key]" class="control select">
            <option v-for="o in field.options" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
          <label class="float-label always">{{ field.label }}</label>
          <svg class="caret" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </template>
        <template v-else-if="field.key === 'jobResponsibilities'">
          <div
            class="responsibilities-control"
            :class="{ focused: responsibilitiesFocused }"
            @click="responsibilityInputEl?.focus()"
          >
            <label class="float-label always">{{ field.label }}</label>
            <span
              v-for="(responsibility, index) in general.jobResponsibilities"
              :key="`${responsibility}-${index}`"
              class="responsibility-chip"
            >
              {{ responsibility }}
              <button
                type="button"
                :aria-label="`Remove ${responsibility}`"
                @click.stop="removeJobResponsibility(index)"
              >
                ×
              </button>
            </span>
            <input
              ref="responsibilityInputEl"
              v-model="responsibilityInput"
              class="responsibility-input"
              name="job-responsibility-entry"
              type="search"
              :placeholder="general.jobResponsibilities.length ? '' : field.placeholder"
              :disabled="general.jobResponsibilities.length >= 5"
              :readonly="!responsibilitiesFocused"
              autocomplete="new-password"
              aria-describedby="job-responsibilities-hint"
              @focus="responsibilitiesFocused = true"
              @blur="responsibilitiesFocused = false"
              @keydown.enter.prevent.stop="addJobResponsibility"
            />
          </div>
          <span id="job-responsibilities-hint" class="field-hint">
            Press enter to add (Maximum 5 allowed)
          </span>
        </template>
        <template v-else>
          <input
            v-model="general[field.key]"
            class="control"
            type="text"
            :placeholder="field.placeholder"
            :aria-invalid="!!errors[field.key]"
          />
          <label class="float-label">{{ field.label }}</label>
        </template>
        <span v-if="errors[field.key]" class="field-error">{{ errors[field.key] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.general {
  padding: 0 18px;
}

.profile-heading {
  margin: 16px 0 14px;
  font-size: 17px;
  font-weight: 400;
  color: #323248;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-bottom: 30px;
}

.avatar {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #8a2fc8, #6f2bb8);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  font-weight: 300;
  overflow: hidden;
  user-select: none;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-info p {
  margin: 0 0 10px;
  font-size: 14px;
  color: #1f1f2e;
}

.upload-btn {
  margin-top: 6px;
  padding: 0 17px;
  height: 32px;
  background: #5559f4;
  color: #fff;
  border: none;
  border-radius: 2px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
}
.upload-btn:hover {
  background: #4448d9;
}

.remove-btn {
  margin: 6px 0 0 24px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: #fb275d;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
}

.remove-btn:hover {
  color: #d91f4d;
}

.photo-error {
  margin: 10px 0 0 !important;
  color: #d83a52;
  font-size: 13px !important;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.field {
  position: relative;
}

.control {
  width: 100%;
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px;
  font-family: inherit;
  font-size: 16px;
  color: #1f1f2e;
  background: #fff;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
  outline: none;
}
.control::placeholder {
  color: #8a8b96;
}
.control:focus {
  border-color: #5559f4;
}

.responsibilities-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 70px;
  box-sizing: border-box;
  padding: 18px 18px 10px;
  background: #fff;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
  cursor: text;
}

.responsibilities-control.focused {
  border: 2px solid #5559f4;
  padding: 17px 17px 9px;
}

.responsibilities-control .float-label {
  top: -8px;
  left: 10px;
  color: #676879;
}

.responsibilities-control.focused .float-label {
  color: #5559f4;
}

.responsibility-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 6px 0 14px;
  border-radius: 18px;
  background: #e3e3e3;
  color: #303030;
  font-size: 14px;
  white-space: nowrap;
}

.responsibility-chip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #777;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.responsibility-input {
  flex: 1 1 100px;
  min-width: 80px;
  height: 30px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1f1f2e;
  font: inherit;
}

.responsibility-input:disabled {
  display: none;
}

.field-hint {
  display: block;
  margin: 6px 0 0 14px;
  color: #676879;
  font-size: 12px;
}

.field.multiline-field .field-error {
  position: static;
  display: block;
  margin: 6px 0 0 14px;
}

.field.invalid .control {
  border: 2px solid #fb275d;
  padding: 0 13px;
}

.field-error {
  position: absolute;
  left: 15px;
  top: 51px;
  font-size: 13px;
  color: #fb275d;
}

.select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 44px;
  cursor: pointer;
}

.caret {
  position: absolute;
  right: 12px;
  top: 23px;
  width: 26px;
  height: 26px;
  transform: translateY(-50%);
  color: #5a5b6a;
  pointer-events: none;
}

/* Floating label sits on the border once the field has a value or focus */
.float-label {
  position: absolute;
  top: -9px;
  left: 11px;
  padding: 0 4px;
  background: #fff;
  font-size: 13px;
  color: #676879;
  line-height: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s;
}
.control:not(:placeholder-shown) + .float-label,
.control:focus + .float-label,
.float-label.always {
  opacity: 1;
}
.control:focus + .float-label {
  color: #5559f4;
}
.field.invalid .float-label {
  color: #fb275d;
}
</style>
