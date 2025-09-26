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

<style scoped src="@/assets/styles/components/AdminPayrollView/AdminSettlementCompletedModal.css"></style>