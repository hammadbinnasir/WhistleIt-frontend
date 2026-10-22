<script setup>

import { nextTick, ref } from 'vue'

import MessageComposer from './MessageComposer.vue'



const messages = ref([])

const messagesContainer = ref(null)



function addMessage(message) {

  messages.value.push({

    ...message,

    scheduledAt: null,

    author: ' ABDULLAH',

    mine: true,

  })

  scrollMessagesToLatest()

}



function addScheduledMessage(message) {

  messages.value.push({ ...message, scheduled: true, author: ' ABDULLAH', mine: true })

  scrollMessagesToLatest()

}



async function scrollMessagesToLatest() {

  await nextTick()

  const container = messagesContainer.value

  if (container) container.scrollTop = container.scrollHeight

}

</script>



<template>

  <section class="composer-conversation">

    <div ref="messagesContainer" class="composer-conversation__messages" aria-live="polite">

      <article

        v-for="(message, index) in messages"

        :key="`${message.content}-${index}`"

        class="composer-conversation__message"

      >

        <span class="composer-conversation__avatar" aria-hidden="true">AU</span>

        <div class="composer-conversation__message-content">

          <header class="composer-conversation__message-heading">

            <strong>{{ message.author }}</strong>

            <time>just now</time>

          </header>

          <div class="composer-conversation__message-bubble">

            <span v-if="message.important" class="composer-conversation__important">

              IMPORTANT!

            </span>

            <p>{{ message.content }}</p>

            <span v-if="message.scheduled" class="composer-conversation__scheduled">

              Scheduled for {{ message.scheduledAt }} ({{ message.timeZone || 'local time' }})

            </span>

            <ul v-if="message.attachments?.length" class="composer-conversation__attachment-list">

              <li v-for="file in message.attachments" :key="`${file.name}-${file.size}`">

                {{ file.name }}

              </li>

            </ul>

            <span

              v-if="message.mine && !message.scheduled"

              class="composer-conversation__sent-status"

              aria-label="Sent"

            >

              ✓✓

            </span>

          </div>

        </div>

      </article>

    </div>

    <MessageComposer @send="addMessage" @schedule="addScheduledMessage" />

  </section>

</template>



<style scoped>

.composer-conversation {

  display: flex;

  min-height: 0;

  flex: 1;

  flex-direction: column;

  background: #f8f9fc;

}



.composer-conversation__messages {

  flex: 1;

  overflow-y: auto;

  padding: 16px;

}



.composer-conversation__message {

  display: grid;

  grid-template-columns: 32px minmax(0, 1fr);

  gap: 10px;

  margin: 0 0 12px;

}



.composer-conversation__avatar {

  display: grid;

  width: 30px;

  height: 30px;

  place-items: center;

  border-radius: 50%;

  background: #77c941;

  color: #25263a;

  font-size: 11px;

  font-weight: 600;

}



.composer-conversation__message-content {

  min-width: 0;

}



.composer-conversation__message-heading {

  display: flex;

  align-items: baseline;

  gap: 14px;

  margin: 0 0 5px;

  color: #25263a;

  font-size: 14px;

}



.composer-conversation__message-heading time {

  color: #696d81;

  font-size: 12px;

}



.composer-conversation__message-bubble {

  position: relative;

  min-height: 36px;

  padding: 8px 30px 8px 8px;

  background: #edeef6;

  color: #25263a;

  overflow-wrap: anywhere;

}



.composer-conversation__message-bubble p {

  margin: 0;

  white-space: pre-wrap;

}



.composer-conversation__sent-status {

  position: absolute;

  right: 8px;

  bottom: 7px;

  color: #afb5d1;

  font-size: 13px;

  letter-spacing: -4px;

}



.composer-conversation__important {

  display: inline-block;

  margin-bottom: 6px;

  padding: 1px 10px;

  border-radius: 999px;

  background: #f04444;

  color: #fff;

  font-size: 10px;

  font-weight: 700;

}



.composer-conversation__scheduled {

  display: block;

  margin-top: 6px;

  color: #696d81;

  font-size: 12px;

}



.composer-conversation__attachment-list {

  margin: 6px 0 0;

  padding-left: 20px;

  color: #696d81;

  font-size: 13px;

}

</style>