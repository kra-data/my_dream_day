<template>
  <span :class="['badge', 'badge-base', 'badge-dot', badgeClass]">
    <AppIcon 
      :name="statusIcon" 
      :size="14" 
      class="inline-block mr-1"
    />
    {{ statusText }}
  </span>
</template>

<script>
export default {
  name: 'StatusBadge',
  props: {
    status: {
      type: String,
      required: true
    }
  },
  computed: {
    statusText() {
      const statusMap = {
        // 출근 관련 상태 (attendance)
        'not-checked-in': '미출근',
        'working': '근무중',
        'attendance-completed': '퇴근완료',
        'late': '지각',
        'early': '조기출근',
        'overtime': '연장근무',
        'incomplete': '근무중',
        
        // 근무 일정 상태 (대소문자 지원)
        'SCHEDULED': '출근 전',
        'scheduled': '출근 전',
        'UPCOMING': '출근 전',
        'ACTIVE': '근무중',
        'IN_PROGRESS': '근무중',
        'in_progress': '근무중',
        'COMPLETED': '퇴근',
        'completed': '퇴근',
        'CANCELLED': '취소됨',
        'CANCELED': '취소됨',
        'canceled': '취소됨',
        'MISSED': '결근',
        'missed': '결근',
        'REVIEW': '검토중',
        'review': '검토중'
      }
      return statusMap[this.status] || '알수없음'
    },
    statusIcon() {
      const iconMap = {
        // 출근 관련 상태 (attendance)
        'not-checked-in': 'clock',
        'working': 'user',
        'attendance-completed': 'check',
        'late': 'warning',
        'early': 'clock',
        'overtime': 'clock',
        'incomplete': 'user',
        
        // 근무 일정 상태 (대소문자 지원)
        'SCHEDULED': 'clock',
        'scheduled': 'clock',
        'UPCOMING': 'clock',
        'ACTIVE': 'user',
        'IN_PROGRESS': 'user',
        'in_progress': 'user',
        'COMPLETED': 'check',
        'completed': 'check',
        'CANCELLED': 'error',
        'CANCELED': 'error',
        'canceled': 'error',
        'MISSED': 'alert-triangle',
        'missed': 'alert-triangle',
        'REVIEW': 'alert-circle',
        'review': 'alert-circle'
      }
      return iconMap[this.status] || 'info'
    },
    badgeClass() {
      const classMap = {
        // 출근 관련 상태 (attendance)
        'not-checked-in': 'badge-gray',
        'working': 'badge-success', 
        'attendance-completed': 'badge-primary',
        'late': 'badge-warning',
        'early': 'badge-success',
        'overtime': 'badge-danger',
        'incomplete': 'badge-success',
        
        // 근무 일정 상태 (대소문자 지원)
        'SCHEDULED': 'badge-primary',
        'scheduled': 'badge-primary',
        'UPCOMING': 'badge-gray',
        'ACTIVE': 'badge-success',
        'IN_PROGRESS': 'badge-success',
        'in_progress': 'badge-success',
        'COMPLETED': 'badge-gray badge-strikethrough',
        'completed': 'badge-gray badge-strikethrough',
        'CANCELLED': 'badge-gray',
        'CANCELED': 'badge-gray',
        'canceled': 'badge-gray',
        'MISSED': 'badge-danger badge-strikethrough',
        'missed': 'badge-danger badge-strikethrough',
        'REVIEW': 'badge-danger',
        'review': 'badge-danger'
      }
      return classMap[this.status] || 'badge-gray'
    }
  }
}
</script>

<style scoped>
/* 🎨 배지 스타일은 components.css에서 관리됩니다 */

/* 추가적인 상태 별 애니메이션 */
.badge {
  animation: badge-appear 0.3s ease-out;
  transition: all var(--transition-fast);
}

.badge:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-sm);
}

@keyframes badge-appear {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 상태별 추가 스타일 */
.badge-strikethrough {
  text-decoration: line-through;
  opacity: 0.7;
}

/* 매칭 애니메이션 */
.badge.badge-success {
  animation: pulse-success 2s infinite;
}

@keyframes pulse-success {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

/* 반응형 디자인 */
@media (max-width: 640px) {
  .badge {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
  }
}
</style>