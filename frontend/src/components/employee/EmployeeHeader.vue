<template>
  <div class="employee-header">
    <div class="welcome-section">
      <h1>안녕하세요, {{ user.name }}님! 👋</h1>
      <p>{{ currentDate }} · {{ currentTime }}</p>
    </div>
    
    <div class="user-actions">
      <button @click="$emit('show-my-page')" class="btn btn-base btn-outline">
        📊 마이페이지
      </button>
      <button @click="$emit('logout')" class="btn btn-base btn-ghost">
        🚪 로그아웃
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EmployeeHeader',
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

<style scoped>
.employee-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-text-inverse);
  margin-bottom: var(--space-8);
  padding: var(--space-6);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.welcome-section h1 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.welcome-section p {
  opacity: 0.9;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.user-actions {
  display: flex;
  gap: var(--space-3);
}

/* 사용자 지정 버튼 스타일 */
.user-actions .btn {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: var(--color-text-inverse);
  backdrop-filter: blur(10px);
}

.user-actions .btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .employee-header {
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
    padding: var(--space-4);
  }
  
  .user-actions {
    flex-direction: column;
    width: 100%;
    gap: var(--space-2);
  }
  
  .user-actions .btn {
    width: 100%;
  }
}
</style>