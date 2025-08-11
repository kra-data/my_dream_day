<template>
  <div class="week-summary card">
    <h3>📅 이번 주 근무 현황</h3>
    <div class="week-grid">
      <div 
        v-for="day in weekSummary" 
        :key="day.date"
        :class="['day-item', day.status]"
      >
        <div class="day-name">{{ day.dayName }}</div>
        <div class="day-date">{{ day.dateStr }}</div>
        <div class="day-hours">{{ day.hours || '-' }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WeekSummary',
  props: {
    weekSummary: {
      type: Array,
      required: true
    }
  }
}
</script>

<style scoped>
.week-summary {
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.week-summary h3 {
  margin-bottom: var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
}

.day-item {
  text-align: center;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-primary);
  transition: all var(--transition-fast);
}

.day-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.day-item.today {
  background: var(--primary-100);
  border-color: var(--primary-400);
  color: var(--primary-700);
}

.day-item.worked {
  background: var(--success-100);
  border-color: var(--success-400);
  color: var(--success-700);
}

.day-item.absent {
  background: var(--danger-100);
  border-color: var(--danger-400);
  color: var(--danger-700);
}

.day-item.future {
  background: var(--gray-100);
  color: var(--gray-500);
}

.day-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.day-date {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}

.day-hours {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .week-grid {
    gap: var(--space-1);
  }
  
  .day-item {
    padding: var(--space-2) var(--space-1);
  }
  
  .day-name, 
  .day-date, 
  .day-hours {
    font-size: var(--text-xs);
  }
}
</style>