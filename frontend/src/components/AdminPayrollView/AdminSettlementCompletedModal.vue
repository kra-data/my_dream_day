<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal settlement-completed-modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="success" :size="20" class="inline-block mr-2" />
          정산 완료
        </h3>
        <button @click="handleClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <div v-if="settlementData" class="settlement-completed">
          <!-- 성공 메시지 -->
          <div class="success-banner">
            <div class="success-icon">
              <AppIcon name="success" :size="48" />
            </div>
            <div class="success-text">
              <h4>{{ settlementData.employee.name }}님의 정산이<br>성공적으로 완료되었습니다!</h4>
              <p class="settlement-id">정산 ID: #{{ settlementData.settlement.id }}</p>
            </div>
          </div>

          <!-- 직원 정보 -->
          <div class="employee-summary">
            <div
              class="employee-avatar"
              :style="{ backgroundColor: getEmployeeColor(settlementData.employee) }"
            >
              {{ settlementData.employee.name.charAt(0) }}
            </div>
            <div class="employee-info">
              <h5>{{ settlementData.employee.name }}</h5>
              <p>{{ formatPayUnit(settlementData.employee.payUnit) }}</p>
            </div>
          </div>

          <!-- 정산 기간 -->
          <div class="settlement-period">
            <div class="period-label">정산 기간</div>
            <div class="period-value">{{ formatSettlementPeriod(settlementData.cycle) }}</div>
          </div>

          <!-- 정산 상세 정보 -->
          <div class="settlement-details">
            <div class="detail-section">
              <h6>근무 정보</h6>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">총 근무시간</span>
                  <span class="value">{{ formatMinutes(settlementData.settlement.workedMinutes) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">적용 근무 건수</span>
                  <span class="value">{{ settlementData.appliedShiftCount }}건</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h6>급여 정산</h6>
              <div class="settlement-breakdown">
                <div class="breakdown-row">
                  <span class="label">기본급</span>
                  <span class="value">{{ formatCurrency(settlementData.settlement.basePay) }}</span>
                </div>
                <div class="breakdown-row">
                  <span class="label">총 급여</span>
                  <span class="value">{{ formatCurrency(settlementData.settlement.totalPay) }}</span>
                </div>
                <div v-if="settlementData.settlement.incomeTax > 0" class="breakdown-row tax">
                  <span class="label">소득세</span>
                  <span class="value">-{{ formatCurrency(settlementData.settlement.incomeTax) }}</span>
                </div>
                <div v-if="settlementData.settlement.localIncomeTax > 0" class="breakdown-row tax">
                  <span class="label">지방소득세</span>
                  <span class="value">-{{ formatCurrency(settlementData.settlement.localIncomeTax) }}</span>
                </div>
                <div v-if="settlementData.settlement.otherTax > 0" class="breakdown-row tax">
                  <span class="label">기타 세금</span>
                  <span class="value">-{{ formatCurrency(settlementData.settlement.otherTax) }}</span>
                </div>
                <div class="breakdown-row total">
                  <span class="label">실 지급액</span>
                  <span class="value">{{ formatCurrency(settlementData.settlement.netPay) }}</span>
                </div>
              </div>
            </div>

            <div v-if="settlementData.settlement.note" class="detail-section">
              <h6>메모</h6>
              <div class="note-content">{{ settlementData.settlement.note }}</div>
            </div>
          </div>

          <!-- 정산 완료 시간 -->
          <div class="settlement-timestamp">
            <AppIcon name="clock" :size="16" class="mr-2" />
            정산 완료 시간: {{ formatDateTime(settlementData.settlement.settledAt) }}
          </div>
        </div>

        <div class="modal-actions">
          <button @click="handleClose" class="btn btn-primary btn-large">
            <AppIcon name="check" :size="16" class="mr-2" />
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppIcon from '@/components/common/AppIcon.vue'

export default {
  name: 'SettlementCompletedModal',
  components: {
    AppIcon
  },
  props: {
    settlementData: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const handleClose = () => {
      emit('close')
    }

    const handleBackdropClick = () => {
      emit('close')
    }

    const formatCurrency = (amount) => {
      if (!amount) return '0원'
      return `${amount.toLocaleString()}원`
    }

    const formatMinutes = (minutes) => {
      if (!minutes || minutes === 0) return '0시간'
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
    }

    const formatPayUnit = (payUnit) => {
      return payUnit === 'HOURLY' ? '시급제' : '월급제'
    }

    const formatSettlementPeriod = (cycle) => {
      if (!cycle || !cycle.start || !cycle.end) return '-'

      const start = new Date(cycle.start)
      const end = new Date(cycle.end)

      return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`
    }

    const formatDateTime = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    const getEmployeeColor = (employee) => {
      const colors = {
        'OWNER': '#8b5cf6',
        'MANAGER': '#06b6d4',
        'STAFF': '#10b981',
        'PART_TIME': '#f59e0b'
      }
      return employee?.personalColor || colors[employee?.position] || '#3b82f6'
    }

    return {
      handleClose,
      handleBackdropClick,
      formatCurrency,
      formatMinutes,
      formatPayUnit,
      formatSettlementPeriod,
      formatDateTime,
      getEmployeeColor
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settlement-completed-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #059669;
  font-size: 20px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 8px;
  line-height: 1;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #1f2937;
  background: #f3f4f6;
}

.modal-body {
  padding: 24px;
}

/* 성공 배너 */
.success-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, #065f46 0%, #059669 100%);
  color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.success-icon {
  flex-shrink: 0;
  color: #d1fae5;
}

.success-text h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.settlement-id {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
  font-weight: 500;
}

/* 직원 요약 */
.employee-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 20px;
}

.employee-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
}

.employee-info h5 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.employee-info p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* 정산 기간 */
.settlement-period {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: center;
}

.period-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.period-value {
  font-size: 16px;
  font-weight: 600;
}

/* 정산 상세 */
.settlement-details {
  space-y: 20px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h6 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-item {
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-item .label {
  font-size: 13px;
  color: #6b7280;
}

.detail-item .value {
  font-weight: 600;
  color: #1f2937;
}

/* 급여 breakdown */
.settlement-breakdown {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.breakdown-row:last-child {
  border-bottom: none;
}

.breakdown-row.tax .value {
  color: #dc2626;
}

.breakdown-row.total {
  background: #059669;
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.breakdown-row .label {
  color: #374151;
}

.breakdown-row .value {
  font-weight: 600;
  color: #1f2937;
}

.breakdown-row.total .label,
.breakdown-row.total .value {
  color: white;
}

/* 메모 */
.note-content {
  background: #fffbeb;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  color: #92400e;
}

/* 타임스탬프 */
.settlement-timestamp {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #6b7280;
}

/* 액션 버튼 */
.modal-actions {
  display: flex;
  justify-content: center;
}

.btn {
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #059669;
  color: white;
}

.btn-primary:hover {
  background: #047857;
  transform: translateY(-1px);
}

.btn-large {
  min-width: 160px;
}

/* 반응형 */
@media (max-width: 640px) {
  .settlement-completed-modal {
    width: 95%;
    margin: 20px;
  }

  .success-banner {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .employee-summary {
    flex-direction: column;
    text-align: center;
  }

  .modal-body {
    padding: 20px;
  }
}
</style>