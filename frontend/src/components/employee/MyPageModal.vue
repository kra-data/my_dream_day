<template>
  <!-- 마이페이지 모달 -->
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content mypage-modal" @click.stop>
      <div class="modal-header">
        <h3>📊 마이페이지</h3>
        <button @click="$emit('close')" class="modal-close">&times;</button>
      </div>
      
      <div class="mypage-content">
        <!-- 개인 정보 -->
        <div class="info-section">
          <h4>👤 개인 정보</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">이름</span>
              <span class="info-value">{{ currentEmployee.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">구역</span>
              <span class="info-value">{{ formatSection(currentEmployee.section) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">직위</span>
              <span class="info-value">{{ formatPosition(currentEmployee.position) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">급여</span>
              <span class="info-value">{{ formatPay(currentEmployee.pay, currentEmployee.payUnit) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">휴대폰</span>
              <span class="info-value">{{ formatPhone(currentEmployee.phone) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">은행</span>
              <span class="info-value">{{ currentEmployee.bank }}</span>
            </div>
          </div>
        </div>

        <!-- 이번 달 급여 정보 -->
        <div class="salary-section">
          <h4>💰 이번 달 급여 정보</h4>
          <div class="salary-card">
            <div class="salary-item">
              <span class="salary-label">총 근무 시간</span>
              <span class="salary-value">{{ monthlyStats.totalHours }}시간</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">기본 급여</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats.baseSalary) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">야근 수당</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats.overtimePay) }}</span>
            </div>
            <div class="salary-item total">
              <span class="salary-label">예상 총 급여</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats.totalSalary) }}</span>
            </div>
          </div>
        </div>

        <!-- 출근 통계 -->
        <div class="stats-section">
          <h4>📈 출근 통계</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats.workDays }}</span>
              <span class="stat-label">출근일</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats.lateDays }}</span>
              <span class="stat-label">지각</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats.absentDays }}</span>
              <span class="stat-label">결근</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats.overtimeDays }}</span>
              <span class="stat-label">야근</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MyPageModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    currentEmployee: {
      type: Object,
      required: true
    },
    monthlyStats: {
      type: Object,
      required: true
    }
  },
  methods: {
    formatSection(section) {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section
    },

    formatPosition(position) {
      const positions = {
        'OWNER': '오너',
        'MANAGER': '매니저',
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position
    },

    formatPay(pay, payUnit) {
      return `${pay.toLocaleString()}원 (${payUnit === 'HOURLY' ? '시급' : '월급'})`
    },

    formatPhone(phone) {
      if (!phone) return '-'
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
    },

    formatCurrency(amount) {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount)
    }
  },
  emits: ['close']
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
}

.modal-content {
  @apply card;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
}

.mypage-modal {
  padding: var(--space-6);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--text-2xl);
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-base);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

.mypage-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.info-section, .salary-section, .stats-section {
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: var(--space-5);
}

.info-section:last-child, 
.salary-section:last-child, 
.stats-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-section h4, 
.salary-section h4, 
.stats-section h4 {
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
}

.info-value {
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
}

.salary-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border: 1px solid var(--color-border-light);
}

.salary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.salary-item.total {
  border-top: 1px solid var(--color-border-light);
  padding-top: var(--space-3);
  font-weight: var(--font-bold);
}

.salary-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
}

.salary-value {
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  font-family: var(--font-mono);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-item {
  text-align: center;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  transition: all var(--transition-fast);
}

.stat-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.stat-number {
  display: block;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
  font-family: var(--font-mono);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
  }
  
  .mypage-modal {
    padding: var(--space-4);
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .info-item {
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .salary-item {
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
  }
}
</style>