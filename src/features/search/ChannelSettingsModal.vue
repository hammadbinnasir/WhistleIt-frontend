<script setup>
import { computed, ref } from 'vue'
import { useSearchStore } from './search.store'

const props = defineProps({
  channel: { type: Object, required: true },
})
const emit = defineEmits(['toggle-mute', 'toggle-favourite', 'left', 'close', 'update-channel'])
const store = useSearchStore()
const tab = ref('settings')
const memberQuery = ref('')
const addQuery = ref('')
const addMembersOpen = ref(false)
const selectedMembers = ref([])
const pollHistoryOpen = ref(false)
const copyMessage = ref('')
const aboutName = ref(props.channel.name)
const aboutDescription = ref(props.channel.description || '')
const aboutSaved = ref(false)
const aboutError = ref('')

const channelMembers = computed(() =>
  store.membersForChannel(props.channel.id).filter((member) =>
    member.name.toLocaleLowerCase().includes(memberQuery.value.trim().toLocaleLowerCase()),
  ),
)
const candidateMembers = computed(() =>
  store
    .availableMembers(props.channel.id)
    .filter((member) =>
      `${member.name} ${member.email}`.toLocaleLowerCase().includes(addQuery.value.trim().toLocaleLowerCase()),
    ),
)
const polls = computed(() => store.pollsForChannel(props.channel.id))
const memberCount = computed(() => store.membersForChannel(props.channel.id).length)

function toggleMember(id) {
  selectedMembers.value = selectedMembers.value.includes(id)
    ? selectedMembers.value.filter((memberId) => memberId !== id)
    : [...selectedMembers.value, id]
}

function addSelectedMembers() {
  if (!selectedMembers.value.length) return
  store.addMembers(props.channel.id, selectedMembers.value)
  selectedMembers.value = []
  addQuery.value = ''
  addMembersOpen.value = false
}

async function copyWebhook() {
  try {
    await navigator.clipboard.writeText('https://app.whistleit.io/api/webhooks/demo')
    copyMessage.value = 'Webhook URL copied.'
  } catch (error) {
    copyMessage.value = `Could not copy the URL: ${error.message}`
  }
}

function saveAbout() {
  const name = aboutName.value.trim()
  if (!name) {
    aboutError.value = 'Channel name is required.'
    aboutSaved.value = false
    return
  }
  aboutError.value = ''
  emit('update-channel', { name, description: aboutDescription.value.trim() })
  aboutSaved.value = true
}
</script>

<template>
  <div class="channel-settings__backdrop" @click.self="emit('close')">
    <section
      class="channel-settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-settings-title"
    >
      <button class="channel-settings__close" type="button" aria-label="Close settings" @click="emit('close')">×</button>
      <h2 id="channel-settings-title">Channel Settings</h2>

      <nav class="channel-settings__tabs" aria-label="Channel settings sections">
        <button :class="{ active: tab === 'settings' }" type="button" @click="tab = 'settings'">Settings</button>
        <button :class="{ active: tab === 'members' }" type="button" @click="tab = 'members'">
          Members <span>{{ memberCount }}</span>
        </button>
        <button :class="{ active: tab === 'integrations' }" type="button" @click="tab = 'integrations'">Integrations</button>
        <button :class="{ active: tab === 'about' }" type="button" @click="tab = 'about'">About</button>
      </nav>

      <div class="channel-settings__content">
        <template v-if="tab === 'settings'">
          <article class="settings-card">
            <div class="settings-card__heading">
              <strong>Mute</strong>
              <button
                class="settings-switch"
                :class="{ 'settings-switch--on': channel.muted }"
                type="button"
                role="switch"
                :aria-checked="channel.muted"
                aria-label="Mute channel"
                @click="emit('toggle-mute')"
              ><span /></button>
            </div>
            <p>Muted channels will not send notifications or message badges.</p>
          </article>
          <article class="settings-card">
            <div class="settings-card__heading">
              <strong>Favourite</strong>
              <button
                class="settings-switch"
                :class="{ 'settings-switch--on': channel.favourite }"
                type="button"
                role="switch"
                :aria-checked="channel.favourite"
                aria-label="Favourite channel"
                @click="emit('toggle-favourite')"
              ><span /></button>
            </div>
            <p>Move important channels to the top of your sidebar for easy access.</p>
          </article>
          <article class="settings-card">
            <strong>Polls</strong>
            <p>Access the history of polls in this channel.</p>
            <button class="settings-primary" type="button" @click="pollHistoryOpen = true">History</button>
          </article>
        </template>

        <section v-else-if="tab === 'members'" class="members-section">
          <label class="settings-search">
            <span aria-hidden="true">⌕</span>
            <input v-model="memberQuery" type="search" placeholder="Search by user name" />
          </label>
          <button
            class="add-members-toggle"
            type="button"
            :aria-expanded="addMembersOpen"
            @click="addMembersOpen = !addMembersOpen; selectedMembers = []; addQuery = ''"
          >
            <span>＋</span>{{ addMembersOpen ? 'Cancel' : 'Add members' }}
          </button>

          <div v-if="addMembersOpen" class="add-members-panel">
            <label class="settings-search">
              <span aria-hidden="true">⌕</span>
              <input v-model="addQuery" type="search" placeholder="Search signed-in users" />
            </label>
            <p v-if="!candidateMembers.length" class="members-empty">No signed-in users found.</p>
            <button
              v-for="member in candidateMembers"
              :key="member.id"
              class="member-row member-row--candidate"
              :class="{ 'member-row--selected': selectedMembers.includes(member.id) }"
              type="button"
              @click="toggleMember(member.id)"
            >
              <span class="member-avatar">{{ member.name.slice(0, 1) }}</span>
              <span class="member-row__details"><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span>
              <span class="member-row__check">{{ selectedMembers.includes(member.id) ? '✓' : '+' }}</span>
            </button>
            <button
              class="settings-primary add-members-panel__submit"
              type="button"
              :disabled="!selectedMembers.length"
              @click="addSelectedMembers"
            >
              Add {{ selectedMembers.length || '' }} member{{ selectedMembers.length === 1 ? '' : 's' }}
            </button>
          </div>

          <p v-if="!channelMembers.length" class="members-empty">No channel members match this search.</p>
          <div
            v-for="member in channelMembers"
            :key="member.id"
            class="member-row"
          >
            <span class="member-avatar" :class="`member-avatar--${member.status}`">{{ member.name.slice(0, 1) }}</span>
            <span class="member-row__details"><strong>{{ member.name }}</strong><small>{{ member.status }}</small></span>
          </div>
        </section>

        <section v-else-if="tab === 'integrations'" class="settings-card integration-card">
          <strong>Webhooks</strong>
          <p>Send messages to WhistleIt from external services using a JSON payload.</p>
          <a href="https://docs.whistleit.io/webhooks" target="_blank" rel="noreferrer">Sample payload</a>
          <div class="webhook-row">
            <input aria-label="Webhook URL example" readonly value="https://app.whistleit.io/api/webhooks/demo" />
            <button type="button" aria-label="Copy webhook URL" @click="copyWebhook">▢</button>
          </div>
          <p v-if="copyMessage" class="integration-card__message" role="status">{{ copyMessage }}</p>
        </section>

        <section v-else class="settings-card about-card">
          <label>
            <strong>Name</strong>
            <input v-model="aboutName" :aria-label="'Name of ' + channel.name" />
          </label>
          <label>
            <strong>Description</strong>
            <textarea v-model="aboutDescription" rows="2" placeholder="Add channel description" />
          </label>
          <div>
            <strong>Created by</strong>
            <p>WhistleIt team</p>
          </div>
          <div class="about-card__actions">
            <span v-if="aboutSaved" role="status">Changes saved.</span>
            <button class="settings-primary" type="button" @click="saveAbout">Save changes</button>
          </div>
          <p v-if="aboutError" class="about-card__error" role="alert">{{ aboutError }}</p>
          <button class="leave-channel" type="button" @click="emit('left')">Leave Channel</button>
        </section>
      </div>

      <div v-if="pollHistoryOpen" class="poll-history__backdrop" @click.self="pollHistoryOpen = false">
        <section class="poll-history" role="dialog" aria-modal="true" aria-labelledby="poll-history-title">
          <header>
            <h3 id="poll-history-title">Poll history</h3>
            <button type="button" aria-label="Close poll history" @click="pollHistoryOpen = false">×</button>
          </header>
          <article v-for="poll in polls" :key="poll.id" class="poll-history__item">
            <strong>{{ poll.question }}</strong>
            <span>{{ poll.votes }} votes · {{ poll.status }}</span>
          </article>
          <p v-if="!polls.length" class="members-empty">There are no polls in this channel yet.</p>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.channel-settings__backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(20 20 30 / 45%);
}
.channel-settings {
  position: relative;
  display: flex;
  width: min(100%, 650px);
  max-height: min(88vh, 720px);
  min-height: min(560px, 80vh);
  flex-direction: column;
  overflow: hidden;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 20px 55px rgb(20 20 30 / 22%);
}
.channel-settings__close {
  position: absolute;
  z-index: 1;
  top: 12px;
  right: 14px;
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #f0f0f7;
  color: #44445c;
  font-size: 22px;
  cursor: pointer;
}
.channel-settings > h2 {
  margin: 25px 40px 16px;
  color: #41415b;
  font-size: 22px;
  font-weight: 600;
  text-align: center;
}
.channel-settings__tabs {
  display: flex;
  justify-content: center;
  gap: 2px;
  border-bottom: 1px solid #e3e3e8;
}
.channel-settings__tabs button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 13px 14px 11px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #75757b;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.4px;
  cursor: pointer;
}
.channel-settings__tabs button.active {
  border-bottom-color: #5b5cff;
  color: #5b5cff;
}
.channel-settings__tabs button span {
  padding: 3px 8px;
  border-radius: 14px;
  background: #5b5cff;
  color: #fff;
  font-size: 12px;
}
.channel-settings__content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 28px 26px;
}
.settings-card {
  margin-bottom: 10px;
  padding: 14px;
  border: 1px solid #d4d4d8;
  border-radius: 5px;
  color: #666;
}
.settings-card strong {
  color: #686868;
  font-size: 14px;
}
.settings-card p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.55;
}
.settings-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.settings-switch {
  position: relative;
  width: 48px;
  height: 28px;
  border: 0;
  border-radius: 16px;
  background: #ddd;
  cursor: pointer;
}
.settings-switch span {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  transition: transform 0.15s ease;
}
.settings-switch--on {
  background: #5b5cff;
}
.settings-switch--on span {
  transform: translateX(20px);
}
.settings-primary {
  margin-top: 14px;
  padding: 9px 16px;
  border: 0;
  border-radius: 4px;
  background: #5b5cff;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.settings-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.members-section {
  padding: 0 10px;
}
.settings-search {
  display: flex;
  height: 43px;
  align-items: center;
  gap: 9px;
  margin-bottom: 12px;
  padding: 0 12px;
  border: 1px solid #5b5cff;
  border-radius: 5px;
  color: #5b5cff;
}
.settings-search span {
  font-size: 23px;
}
.settings-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #333;
  font: inherit;
}
.add-members-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 5px 0 14px 8px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #5b5cff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  cursor: pointer;
}
.add-members-toggle span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #5b5cff;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 400;
}
.add-members-panel {
  margin-bottom: 14px;
  padding: 10px;
  border: 1px solid #e4e4ea;
  border-radius: 6px;
  background: #fafaff;
}
.member-row {
  display: flex;
  min-height: 47px;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  color: #393946;
}
.member-row--candidate {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.member-row--candidate:hover,
.member-row--selected {
  background: #ededff;
}
.member-avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 50%;
  background: #7a36c8;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.member-avatar--online {
  background: #6aaf48;
}
.member-avatar--away {
  background: #ea8727;
}
.member-avatar--offline {
  background: #8b8b9b;
}
.member-row__details {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}
.member-row__details strong {
  font-size: 14px;
  font-weight: 500;
}
.member-row__details small {
  color: #858590;
  font-size: 11px;
}
.member-row__check {
  color: #5b5cff;
  font-size: 19px;
}
.add-members-panel__submit {
  display: block;
  margin-left: auto;
}
.members-empty {
  margin: 12px 6px;
  color: #777;
  font-size: 13px;
}
.integration-card > a {
  display: inline-block;
  margin-top: 12px;
  color: #4779df;
}
.webhook-row {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.webhook-row input {
  min-width: 0;
  flex: 1;
  padding: 9px;
  border: 1px solid #bcbcc4;
  border-radius: 4px;
  background: #f3f3f5;
  color: #333;
  font: inherit;
}
.webhook-row button {
  width: 42px;
  border: 0;
  border-radius: 4px;
  background: #5b5cff;
  color: #fff;
  font-size: 23px;
  cursor: pointer;
}
.integration-card .integration-card__message {
  font-size: 12px;
}
.about-card {
  padding: 0;
}
.about-card > * {
  display: block;
  width: 100%;
  padding: 13px 14px;
  border-bottom: 1px solid #ddd;
  box-sizing: border-box;
}
.about-card label strong,
.about-card > div strong {
  display: block;
  margin-bottom: 4px;
}
.about-card input,
.about-card textarea {
  width: 100%;
  border: 0;
  outline: 0;
  color: #666;
  font: inherit;
  resize: vertical;
}
.about-card p {
  margin: 0;
}
.about-card .leave-channel {
  border: 0;
  color: #e34a4a;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.about-card .about-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.about-card__actions span {
  color: #4f8b50;
  font-size: 12px;
}
.about-card__actions .settings-primary {
  margin-top: 0;
}
.about-card__error {
  color: #c73546;
  font-size: 12px;
}
.poll-history__backdrop {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(20 20 30 / 30%);
}
.poll-history {
  width: min(100%, 440px);
  max-height: 80%;
  overflow-y: auto;
  padding: 18px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 12px 35px rgb(20 20 30 / 25%);
}
.poll-history header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.poll-history h3 {
  margin: 0;
  color: #3e3e54;
}
.poll-history header button {
  border: 0;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}
.poll-history__item {
  display: grid;
  gap: 8px;
  margin-top: 13px;
  padding: 13px;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #424252;
}
.poll-history__item span {
  color: #777;
  font-size: 12px;
}
@media (max-width: 540px) {
  .channel-settings {
    min-height: min(540px, 85vh);
  }
  .channel-settings > h2 {
    margin-top: 20px;
    font-size: 19px;
  }
  .channel-settings__tabs button {
    padding-right: 7px;
    padding-left: 7px;
    font-size: 12px;
  }
  .channel-settings__content {
    padding: 14px;
  }
}
</style>
