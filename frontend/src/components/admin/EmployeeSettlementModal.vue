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

<style scoped src="@/assets/styles/admin/EmployeeSettlementModal.css"></style>
