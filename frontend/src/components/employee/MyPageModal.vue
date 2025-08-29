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
              <span class="info-value">{{ currentEmployee?.name || '정보 없음' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">구역</span>
              <span class="info-value">{{ formatSection(currentEmployee?.section) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">직위</span>
              <span class="info-value">{{ formatPosition(currentEmployee?.position) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">급여</span>
              <span class="info-value">{{ formatPay(currentEmployee?.pay, currentEmployee?.payUnit) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">휴대폰</span>
              <span class="info-value">{{ formatPhone(currentEmployee?.phone) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">은행</span>
              <span class="info-value">{{ currentEmployee?.bank || '정보 없음' }}</span>
            </div>
          </div>
        </div>

        <!-- 정산 정보 (7일 기준) -->
        <div class="settlement-section">
          <h4>💳 정산 정보 (7일 기준)</h4>
          <div class="settlement-card">
            <div class="settlement-period-info">
              <div class="period-badge current">
                <span class="period-title">현재 정산 기간</span>
                <span class="period-date">{{ currentSettlementPeriod }}</span>
              </div>
            </div>
            
            <div class="settlement-amounts">
              <div class="amount-row unsettled">
                <span class="amount-icon">⏳</span>
                <div class="amount-content">
                  <span class="amount-label">이번달 미정산 금액</span>
                  <span class="amount-value">{{ formatCurrency(settlementInfo.currentPeriod?.amount || 0) }}</span>
                </div>
                <div class="amount-status">
                  <span class="status-badge pending">미정산</span>
                </div>
              </div>
              
              <div class="amount-row settled">
                <span class="amount-icon">✅</span>
                <div class="amount-content">
                  <span class="amount-label">지난달 정산 금액</span>
                  <span class="amount-value">{{ formatCurrency(settlementInfo.lastSettlement?.amount || 0) }}</span>
                </div>
                <div class="amount-status">
                  <span class="status-badge completed">정산완료</span>
                  <span class="settlement-date">{{ formatSettlementDate(settlementInfo.lastSettlement?.settlementDate) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 이번 달 급여 정보 -->
        <div class="salary-section">
          <h4>💰 이번 달 급여 정보</h4>
          <div class="salary-card">
            <div class="salary-item">
              <span class="salary-label">총 근무 시간</span>
              <span class="salary-value">{{ monthlyStats?.totalHours || 0 }}시간</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">기본 급여</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats?.baseSalary || 0) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">야근 수당</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats?.overtimePay || 0) }}</span>
            </div>
            <div class="salary-item total">
              <span class="salary-label">예상 총 급여</span>
              <span class="salary-value">{{ formatCurrency(monthlyStats?.totalSalary || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 출근 통계 -->
        <div class="stats-section">
          <h4>📈 출근 통계</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats?.workDays || 0 }}</span>
              <span class="stat-label">출근일</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats?.lateDays || 0 }}</span>
              <span class="stat-label">지각</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats?.absentDays || 0 }}</span>
              <span class="stat-label">결근</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ monthlyStats?.overtimeDays || 0 }}</span>
              <span class="stat-label">야근</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { usePayrollStore } from '@/stores/payroll'

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
  setup(props) {
    const payrollStore = usePayrollStore()
    const settlementInfo = ref({
      currentPeriod: null,
      lastSettlement: null
    })


    // 7일 기준 정산 기간 계산
    const get7DaySettlementPeriod = () => {
      const now = new Date()
      const currentDate = now.getDate()
      
      if (currentDate >= 7) {
        // 이번 달 7일부터 다음 달 6일까지
        const startDate = new Date(now.getFullYear(), now.getMonth(), 7)
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 6)
        return `${startDate.getMonth() + 1}월 7일 ~ ${endDate.getMonth() + 1}월 6일`
      } else {
        // 지난 달 7일부터 이번 달 6일까지
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 7)
        const endDate = new Date(now.getFullYear(), now.getMonth(), 6)
        return `${startDate.getMonth() + 1}월 7일 ~ ${endDate.getMonth() + 1}월 6일`
      }
    }

    const currentSettlementPeriod = computed(() => {
      return get7DaySettlementPeriod()
    })

    // 정산 정보 로드
    const loadSettlementInfo = async () => {
      const employeeId = props.currentEmployee?.id || props.currentEmployee?.userId || props.currentEmployee?.empId
      if (employeeId) {
        try {
          const data = await payrollStore.getEmployeeSettlement(employeeId)
          settlementInfo.value = data || {
            currentPeriod: { amount: 0, settled: false },
            lastSettlement: { amount: 0, settlementDate: null, settled: true }
          }
        } catch (error) {
          console.error('정산 정보 로드 실패:', error)
          // 기본값 설정
          settlementInfo.value = {
            currentPeriod: { amount: props.currentEmployee.pay || 0, settled: false },
            lastSettlement: { amount: props.currentEmployee.pay || 0, settlementDate: new Date().toISOString(), settled: true }
          }
        }
      } else {
        // 직원 ID가 없는 경우 기본값 설정
        settlementInfo.value = {
          currentPeriod: { amount: props.currentEmployee?.pay || 0, settled: false },
          lastSettlement: { amount: props.currentEmployee?.pay || 0, settlementDate: new Date().toISOString(), settled: true }
        }
      }
    }

    // 모달이 열릴 때 정산 정보 로드
    watch(() => props.show, (newShow) => {
      if (newShow) {
        loadSettlementInfo()
      }
    })

    return {
      settlementInfo,
      currentSettlementPeriod
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
      if (!pay) return '정보 없음'
      const unit = payUnit === 'HOURLY' ? '시급' : '월급'
      return `${pay.toLocaleString()}원 (${unit})`
    },

    formatPhone(phone) {
      if (!phone) return '-'
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
    },

    formatCurrency(amount) {
      if (!amount && amount !== 0) return '₩0'
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount)
    },

    formatSettlementDate(dateString) {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric'
      }) + ' 정산'
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
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
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

/* 정산 섹션 스타일 */
.settlement-section {
  border: 2px solid #10b981;
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
}

.settlement-section h4 {
  color: #065f46;
  margin-bottom: var(--space-4);
}

.settlement-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settlement-period-info {
  display: flex;
  justify-content: center;
}

.period-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: white;
  border-radius: var(--radius-base);
  border: 1px solid #10b981;
}

.period-title {
  font-size: var(--text-sm);
  color: #6b7280;
  font-weight: var(--font-medium);
}

.period-date {
  font-size: var(--text-base);
  color: #059669;
  font-weight: var(--font-bold);
}

.settlement-amounts {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.amount-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: white;
  border-radius: var(--radius-base);
  border: 1px solid #e5e7eb;
}

.amount-row.unsettled {
  border-left: 4px solid #f59e0b;
}

.amount-row.settled {
  border-left: 4px solid #10b981;
}

.amount-icon {
  font-size: var(--text-xl);
}

.amount-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.amount-label {
  font-size: var(--text-sm);
  color: #6b7280;
  font-weight: var(--font-medium);
}

.amount-value {
  font-size: var(--text-lg);
  color: #1f2937;
  font-weight: var(--font-bold);
  font-family: var(--font-mono);
}

.amount-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.settlement-date {
  font-size: var(--text-xs);
  color: #6b7280;
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
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-light);
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