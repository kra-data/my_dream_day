<template>
  <div class="employee-header">
    <div class="welcome-section">
      <h1>안녕하세요, {{ user.name }}님! <AppIcon name="hand" :size="24" class="ml-2" /></h1>
      <p>{{ currentDate }} · {{ currentTime }}</p>
    </div>
    
    <div class="user-actions">
      <button @click="$emit('show-my-page')" class="btn btn-base btn-outline">
        <AppIcon name="stats" :size="18" class="mr-2" />마이페이지
      </button>
      <button @click="$emit('logout')" class="btn btn-base btn-ghost">
        <AppIcon name="arrow-right" :size="18" class="mr-2" />로그아웃
      </button>
    </div>
  </div>
</template>

<script>
import AppIcon from '@/components/common/AppIcon.vue'

export default {
  name: 'EmployeeHeader',
  components: {
    AppIcon
  },
  props: {
    user: {
      type: Object,
      required: true
    },
    currentDate: {
      type: String,
      required: true
    },
    currentTime: {
      type: String,
      required: true
    }
  },
  emits: ['show-my-page', 'logout']
}
</script>

<style scoped src="@/assets/styles/components/EmployeeView/EmployeeHeader.css"></style>
