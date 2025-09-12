<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="money" :size="18" class="inline-block mr-2" />
          직원 정산 확인
        </h3>
        <button @click="handleClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="settlementData" class="settlement-info">
          <div class="employee-info">
            <div 
              class="employee-avatar" 
              :style="{ backgroundColor: getEmployeeColor(settlementData.employee) }"
            >
              {{ settlementData.employee.name.charAt(0) }}
            </div>
            <div class="employee-details">
              <h4>{{ settlementData.employee.name }}</h4>
              <p>{{ formatPosition(settlementData.employee.position) }} · {{ settlementData.employee.payUnit === 'HOURLY' ? '시급' : '월급' }}</p>
            </div>
          </div>

          <div class="settlement-summary">
            <div class="summary-row">
              <span class="label">근무 시간</span>
              <span class="value">{{ formatMinutes(settlementData.workedMinutes || 0) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">기본 급여</span>
              <span class="value">{{ formatCurrency(settlementData.amount || 0) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">소득세 ({{ ((settlementData.incomeTax || 0) / Math.max(settlementData.amount || 1, 1) * 100).toFixed(1) }}%)</span>
              <span class="value tax">-{{ formatCurrency(settlementData.incomeTax || 0) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">지방소득세</span>
              <span class="value tax">-{{ formatCurrency(settlementData.localIncomeTax || 0) }}</span>
            </div>
            <div v-if="settlementData.otherTax && settlementData.otherTax > 0" class="summary-row">
              <span class="label">기타 세금</span>
              <span class="value tax">-{{ formatCurrency(settlementData.otherTax) }}</span>
            </div>
            <div class="summary-row total">
              <span class="label">실 지급액</span>
              <span class="value">{{ formatCurrency(settlementData.netAmount || calculateNetAmount()) }}</span>
            </div>
          </div>

          <div class="confirmation-text">
            <p><strong>{{ settlementData.employee.name }}</strong>님의 급여를 정산하시겠습니까?</p>
            <p class="note">정산 후에는 취소할 수 없습니다.</p>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="handleClose" class="btn btn-secondary">
            취소
          </button>
          <button @click="handleConfirm" :disabled="loading" class="btn btn-primary">
            <span v-if="loading">처리 중...</span>
            <span v-else>정산 확인</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'EmployeeSettlementModal',
  components: {
    AppIcon
  },
  props: {
    settlementData: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const handleConfirm = () => {
      emit('confirm', props.settlementData)
    }

    const handleClose = () => {
      emit('cancel')
    }

    const handleBackdropClick = () => {
      emit('cancel')
    }

    const formatCurrency = (amount) => {
      if (!amount) return '0원'
      return `${amount.toLocaleString()}원`
    }

    const formatPosition = (position) => {
      const positions = {
        'OWNER': '점장',
        'MANAGER': '매니저', 
        'STAFF': '직원',
        'PART_TIME': '알바'
      }
      return positions[position] || position
    }

    const getEmployeeColor = (employee) => {
      const colors = {
        'OWNER': '#8b5cf6',
        'MANAGER': '#06b6d4',
        'STAFF': '#10b981',
        'PART_TIME': '#f59e0b'
      }
      return employee.personalColor || colors[employee.position] || '#3b82f6'
    }

    const formatMinutes = (minutes) => {
      if (!minutes || minutes <= 0) return '0시간'
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
    }

    const calculateNetAmount = () => {
      const amount = props.settlementData?.amount || 0
      const incomeTax = props.settlementData?.incomeTax || 0
      const localIncomeTax = props.settlementData?.localIncomeTax || 0
      const otherTax = props.settlementData?.otherTax || 0
      return Math.max(0, amount - incomeTax - localIncomeTax - otherTax)
    }

    return {
      handleConfirm,
      handleClose,
      handleBackdropClick,
      formatCurrency,
      formatPosition,
      formatMinutes,
      calculateNetAmount,
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

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #1f2937;
  background: #f3f4f6;
}

.modal-body {
  padding: 20px 24px 24px;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
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

.employee-details h4 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.employee-details p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.settlement-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.summary-row:not(:last-child) {
  border-bottom: 1px solid #e2e8f0;
}

.summary-row.total {
  font-weight: 600;
  font-size: 16px;
  background: #84a9e4c6;
  color: white;
  margin: 8px -16px -16px;
  padding: 12px 16px;
  border-radius: 0 0 6px 6px;
}

.label {
  color: #374151;
}

.value {
  font-weight: 600;
  color: #1f2937;
}

.value.tax {
  color: #dc2626;
}

.confirmation-text {
  text-align: center;
  margin-bottom: 24px;
}

.confirmation-text p {
  margin: 8px 0;
  color: #374151;
}

.confirmation-text .note {
  font-size: 14px;
  color: #6b7280;
  font-style: italic;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
  min-width: 100px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
  color: #1f2937;
}

@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 20px;
  }
  
  .modal-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
}
</style>