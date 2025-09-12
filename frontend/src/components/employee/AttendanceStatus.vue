<template>
  <div class="attendance-card card">
    <div class="status-display">
      <div class="current-status">
        <StatusBadge :status="currentStatus" />
        <h2>{{ statusMessage }}</h2>
      </div>
      
      <div class="time-display">
        <div v-if="attendanceStore.currentStatus.clockInAt" class="time-item">
          <span class="time-label"><AppIcon name="arrow-right" :size="16" class="mr-1" />출근</span>
          <span class="time-value">{{ formatTime(attendanceStore.currentStatus.clockInAt) }}</span>
        </div>
        
        <div v-if="!attendanceStore.isOnDuty && attendanceStore.currentStatus.clockInAt" class="time-item">
          <span class="time-label"><AppIcon name="arrow-left" :size="16" class="mr-1" />퇴근</span>
          <span class="time-value">완료</span>
        </div>
        
        <div v-if="attendanceStore.workingHours" class="time-item">
          <span class="time-label"><AppIcon name="clock" :size="16" class="mr-1" />근무시간</span>
          <span class="time-value">{{ attendanceStore.workingHours }}</span>
        </div>
      </div>
    </div>

    <!-- 출퇴근 버튼 -->
    <div class="action-buttons">
      <button 
        v-if="attendanceStore.canCheckIn"
        @click="showQRModal('check-in')"
        class="btn btn-success btn-base"
        :class="{ 'btn-loading': attendanceLoading }"
        :disabled="attendanceLoading"
      >
        <span v-if="!attendanceLoading"><AppIcon name="arrow-right" :size="16" class="mr-1" />출근하기</span>
        <span v-else>처리 중...</span>
      </button>
      
      <button 
        v-if="attendanceStore.canCheckOut"
        @click="showQRModal('check-out')"
        class="btn btn-warning btn-base"
        :class="{ 'btn-loading': attendanceLoading }"
        :disabled="attendanceLoading"
      >
        <span v-if="!attendanceLoading"><AppIcon name="arrow-left" :size="16" class="mr-1" />퇴근하기</span>
        <span v-else>처리 중...</span>
      </button>
    </div>
  </div>
</template>

<script>
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'AttendanceStatus',
  components: { StatusBadge, AppIcon },
  props: {
    attendanceStore: {
      type: Object,
      required: true
    },
    attendanceLoading: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    currentStatus() {
      if (!this.attendanceStore.currentStatus.clockInAt) return 'not-checked-in'
      if (this.attendanceStore.isOnDuty) return 'working'
      return 'completed'
    },
    statusMessage() {
      const messages = {
        'not-checked-in': '출근 전입니다',
        'working': '근무 중입니다',
        'completed': '퇴근 완료'
      }
      return messages[this.currentStatus]
    }
  },
  methods: {
    showQRModal(action) {
      this.$emit('show-qr-modal', action)
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  emits: ['show-qr-modal']
}
</script>

<style scoped src="@/assets/styles/employee/AttendanceStatus.css"></style>
