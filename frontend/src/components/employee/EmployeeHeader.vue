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
import AppIcon from '@/components/AppIcon.vue'

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

<style scoped>
.employee-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-text-primary);
  margin-bottom: var(--space-8);
  padding: var(--space-6);
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.welcome-section h1 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
  background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-section p {
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.user-actions {
  display: flex;
  gap: var(--space-3);
}

/* 라이트 테마 버튼 스타일 */
.user-actions .btn {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-light);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.user-actions .btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
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