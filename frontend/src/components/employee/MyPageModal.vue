<template>
  <!-- 마이페이지 모달 -->
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content mypage-modal" @click.stop>
      <div class="modal-header">
        <h3><AppIcon name="stats" :size="20" class="mr-2" />마이페이지</h3>
        <button @click="$emit('close')" class="modal-close">&times;</button>
      </div>
      
      <div class="mypage-content">
        <!-- 개인 정보 -->
        <div class="info-section">
          <h4><AppIcon name="user" :size="18" class="mr-2" />개인 정보</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">이름</span>
              <span class="info-value">{{ settlementData?.profile?.name || '정보 없음' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">구역</span>
              <span class="info-value">{{ formatSection(settlementData?.profile?.section) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">직위</span>
              <span class="info-value">{{ formatPosition(settlementData?.profile?.position) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">급여</span>
              <span class="info-value">{{ formatPay(settlementData?.profile?.pay, settlementData?.profile?.payUnit) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">휴대폰</span>
              <span class="info-value">{{ settlementData?.profile?.phoneMasked || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">은행</span>
              <div class="bank-info">
                <span class="bank-name">{{ settlementData?.profile?.bank || '정보 없음' }}</span>
                <span v-if="!settlementData?.profile?.bankRegistered" class="bank-warning"><AppIcon name="warning" :size="16" class="mr-1" />계좌 등록 필요</span>
                <span v-else class="bank-registered"><AppIcon name="check" :size="16" class="mr-1" />등록완료</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 정산 정보 -->
        <div class="settlement-section">
          <h4><AppIcon name="currency" :size="18" class="mr-2" />정산 정보</h4>
          <div class="settlement-card">
            <div class="settlement-period-info">
              <div class="period-badge current">
                <span class="period-title">현재 정산 기간</span>
                <span class="period-date">{{ settlementData?.cycle?.label || '-' }}</span>
              </div>
            </div>
            
            <div class="settlement-amounts">
              <!-- 정산 완료된 금액만 표시 -->
              <div class="amount-row settled">
                <span class="amount-icon"><AppIcon name="success" :size="16" /></span>
                <div class="amount-content">
                  <span class="amount-label">이전 사이클 정산 금액</span>
                  <span class="amount-value">{{ formatCurrency(settlementData?.cards?.previous?.amount || 0) }}</span>
                </div>
                <div class="amount-status">
                  <span class="status-badge" :class="getStatusClass(settlementData?.cards?.previous?.status)">
                    {{ getStatusText(settlementData?.cards?.previous?.status) }}
                  </span>
                  <span v-if="settlementData?.cards?.previous?.settledAt" class="settlement-date">
                    {{ formatSettlementDate(settlementData?.cards?.previous?.settledAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 이번 달 급여 정보 -->
        <div class="salary-section">
          <h4><AppIcon name="money" :size="18" class="mr-2" />{{ settlementData?.month?.year }}년 {{ settlementData?.month?.month }}월 급여 정보</h4>
          <div class="salary-card">
            <div class="salary-item">
              <span class="salary-label">총 근무 시간</span>
              <span class="salary-value">{{ formatWorkingHours(settlementData?.month?.workedMinutes) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">기본 급여</span>
              <span class="salary-value">{{ formatCurrency(settlementData?.month?.basePay || 0) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">추가 수당</span>
              <span class="salary-value">{{ formatCurrency((settlementData?.month?.totalPay || 0) - (settlementData?.month?.basePay || 0)) }}</span>
            </div>
            <div class="salary-item total">
              <span class="salary-label">예상 총 급여</span>
              <span class="salary-value">{{ formatCurrency(settlementData?.month?.totalPay || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 출근 통계 -->
        <div class="stats-section">
          <h4><AppIcon name="chart" :size="18" class="mr-2" />출근 통계</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.presentDays || 0 }}</span>
              <span class="stat-label">출근일</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.lateCount || 0 }}</span>
              <span class="stat-label">지각</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.absentCount || 0 }}</span>
              <span class="stat-label">결근</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ Math.round((settlementData?.month?.workedHours || 0) / 8) || 0 }}</span>
              <span class="stat-label">추정 출근일</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { useAttendanceStore } from '@/stores/attendance'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'MyPageModal',
  components: {
    AppIcon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const attendanceStore = useAttendanceStore()
    const settlementData = ref(null)
    const loading = ref(false)


    // 정산 정보 로드
    const loadSettlementInfo = async () => {
      loading.value = true
      try {
        const data = await attendanceStore.fetchMySettlement()
        settlementData.value = data
        console.log('정산 정보 로드 성공:', data)
      } catch (error) {
        console.error('정산 정보 로드 실패:', error)
        // 기본값 설정
        settlementData.value = {
          profile: {
            name: '정보 없음',
            section: 'UNKNOWN',
            position: 'UNKNOWN',
            pay: 0,
            payUnit: 'MONTHLY',
            phoneMasked: '-',
            bank: '정보 없음',
            bankRegistered: false
          },
          cycle: {
            label: '-'
          },
          cards: {
            current: { amount: 0, status: 'PENDING' },
            previous: { amount: 0, status: 'PAID' }
          },
          month: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            workedMinutes: 0,
            workedHours: 0,
            basePay: 0,
            totalPay: 0
          },
          stats: {
            presentDays: 0,
            lateCount: 0,
            absentCount: 0
          }
        }
      } finally {
        loading.value = false
      }
    }

    // 모달이 열릴 때 정산 정보 로드
    watch(() => props.show, (newShow) => {
      if (newShow) {
        loadSettlementInfo()
      }
    })

    return {
      settlementData,
      loading,
      loadSettlementInfo
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

    formatWorkingHours(workedMinutes) {
      if (!workedMinutes) return '0시간 0분'
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      return `${hours}시간 ${minutes}분`
    },

    getStatusClass(status) {
      const statusClasses = {
        'PENDING': 'pending',
        'PAID': 'completed',
        'PROCESSING': 'processing',
        'CANCELLED': 'cancelled'
      }
      return statusClasses[status] || 'pending'
    },

    getStatusText(status) {
      const statusTexts = {
        'PENDING': '미정산',
        'PAID': '정산완료',
        'PROCESSING': '정산중',
        'CANCELLED': '취소'
      }
      return statusTexts[status] || '알 수 없음'
    },

    formatCurrency(amount) {
      if (!amount && amount !== 0) return '0원'
      return `${amount.toLocaleString('ko-KR')}원`
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
  watch: {
    show(newShow) {
      if (newShow) {
        this.loadSettlementInfo()
      }
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

.status-badge.processing {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.cancelled {
  background: #fecaca;
  color: #b91c1c;
}

.bank-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bank-name {
  font-weight: 600;
}

.bank-warning {
  font-size: 0.75rem;
  color: #f59e0b;
  font-weight: 500;
}

.bank-registered {
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 500;
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