<template>
  <span :class="['badge', 'badge-base', 'badge-dot', badgeClass]">
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
        'not-checked-in': '🕰️ 미출근',
        'working': '💼 근무중',
        'completed': '✅ 퇴근완료',
        'late': '⚠️ 지각',
        'early': '🌅 조기출근',
        'overtime': '🌙 연장근무'
      }
      return statusMap[this.status] || '❓ 알수없음'
    },
    badgeClass() {
      const classMap = {
        'not-checked-in': 'badge-gray',
        'working': 'badge-success', 
        'completed': 'badge-primary',
        'late': 'badge-warning',
        'early': 'badge-success',
        'overtime': 'badge-danger'
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