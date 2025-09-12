<template>
  <div class="attendance-card card">
    <div class="employee-info">
      <div class="avatar avatar-lg">
        {{ employee.name.charAt(0) }}
      </div>
      <div class="details">
        <h3 class="employee-name">{{ employee.name }}</h3>
        <p class="employee-meta">{{ employee.department }} · {{ employee.position }}</p>
      </div>
    </div>

    <div class="attendance-status">
      <StatusBadge :status="currentStatus" />
      <div class="time-info">
        <div v-if="todayRecord.checkIn" class="time-entry check-in">
          <span class="time-label">🌅 출근</span>
          <span class="time-value">{{ formatTime(todayRecord.checkIn) }}</span>
        </div>
        <div v-if="todayRecord.checkOut" class="time-entry check-out">
          <span class="time-label">🌆 퇴근</span>
          <span class="time-value">{{ formatTime(todayRecord.checkOut) }}</span>
        </div>
        <div v-if="!todayRecord.checkIn && !todayRecord.checkOut" class="time-entry no-record">
          <span class="time-label">⏰ 대기 중</span>
          <span class="time-value">출근 대기</span>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <button 
        @click="handleCheckIn"
        :disabled="!canCheckIn"
        class="btn btn-success btn-base"
        :class="{ 'btn-loading': attendanceStore.loading }"
      >
        <span v-if="!attendanceStore.loading">📍 출근하기</span>
        <span v-else>처리 중...</span>
      </button>
      <button 
        @click="handleCheckOut"
        :disabled="!canCheckOut"
        class="btn btn-warning btn-base"
        :class="{ 'btn-loading': attendanceStore.loading }"
      >
        <span v-if="!attendanceStore.loading">🚪 퇴근하기</span>
        <span v-else>처리 중...</span>
      </button>
    </div>
  </div>
</template>

<script>
import StatusBadge from './StatusBadge.vue'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AttendanceCard',
  components: { StatusBadge },
  props: {
    employee: {
      type: Object,
      required: true
    }
  },
  setup() {
    const attendanceStore = useAttendanceStore()
    return { attendanceStore }
  },
  computed: {
    todayRecord() {
      return this.attendanceStore.getTodayRecord(this.employee.id) || {}
    },
    currentStatus() {
      if (!this.todayRecord.checkIn) return 'not-checked-in'
      if (!this.todayRecord.checkOut) return 'working'
      return 'completed'
    },
    canCheckIn() {
      return !this.todayRecord.checkIn
    },
    canCheckOut() {
      return this.todayRecord.checkIn && !this.todayRecord.checkOut
    }
  },
  methods: {
    async handleCheckIn() {
      try {
        await this.attendanceStore.checkIn(this.employee.id)
        this.$emit('attendance-updated')
      } catch (error) {
        console.error('출근 처리 실패:', error)
      }
    },
    
    async handleCheckOut() {
      try {
        await this.attendanceStore.checkOut(this.employee.id)
        this.$emit('attendance-updated')
      } catch (error) {
        console.error('퇴근 처리 실패:', error)
      }
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  }
}
</script>

<style scoped>
/* 🎨 모던 출퇴근 카드 디자인 */
.attendance-card {
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.attendance-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.attendance-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--success-400), var(--warning-400), var(--primary-400));
}

.employee-info {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-5);
  padding: var(--space-2) 0;
}

.details {
  flex: 1;
  margin-left: var(--space-4);
}

.employee-name {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.employee-meta {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.employee-meta::before {
  content: '🏢';
  font-size: var(--text-sm);
}

.attendance-status {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
}

.time-info {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.time-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
  transition: all var(--transition-fast);
}

.time-entry:hover {
  border-color: var(--color-border-medium);
  box-shadow: var(--shadow-xs);
}

.time-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.time-value {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.check-in {
  border-left: 3px solid var(--success-500);
}

.check-out {
  border-left: 3px solid var(--warning-500);
}

.no-record {
  border-left: 3px solid var(--gray-400);
}

.no-record .time-value {
  color: var(--color-text-tertiary);
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.action-buttons .btn {
  flex: 1;
  font-weight: var(--font-semibold);
  position: relative;
}

/* 반응형 디자인 */
@media (max-width: 640px) {
  .attendance-card {
    padding: var(--space-4);
  }
  
  .employee-info {
    margin-bottom: var(--space-4);
  }
  
  .employee-name {
    font-size: var(--text-lg);
  }
  
  .action-buttons {
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .time-entry {
    padding: var(--space-2) var(--space-3);
  }
}

/* 로딩 애니메이션 */
.btn-loading {
  pointer-events: none;
}

.btn-loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1rem;
  height: 1rem;
  margin: -0.5rem 0 0 -0.5rem;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: btn-spin 1s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>