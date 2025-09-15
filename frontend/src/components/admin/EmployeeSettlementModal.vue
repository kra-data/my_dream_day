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
        <div v-if="loading" class="loading-section">
          <div class="loading-spinner"></div>
          <p>정산 정보를 불러오는 중...</p>
        </div>

        <div v-else-if="error" class="error-section">
          <div class="error-icon"><AppIcon name="warning" :size="48" /></div>
          <h4>오류가 발생했습니다</h4>
          <p>{{ error }}</p>
        </div>

        <div v-else-if="employeeDetail" class="settlement-info">
          <div class="employee-info">
            <div
              class="employee-avatar"
              :style="{ backgroundColor: getEmployeeColor(employeeDetail.employee) }"
            >
              {{ employeeDetail.employee.name.charAt(0) }}
            </div>
            <div class="employee-details">
              <h4>{{ employeeDetail.employee.name }}</h4>
              <p>{{ formatPosition(employeeDetail.employee.position) }} · {{ employeeDetail.employee.payUnit === 'HOURLY' ? '시급' : '월급' }}</p>
              <div class="pay-info">
                <span class="pay-rate">{{ formatCurrency(employeeDetail.employee.pay) }}</span>
                <span v-if="employeeDetail.cycle" class="pay-period">{{ employeeDetail.cycle.label }}</span>
              </div>
            </div>
          </div>

          <!-- 정산 기간 정보 -->
          <div v-if="employeeDetail.cycle" class="period-info">
            <div class="period-label">정산 기간</div>
            <div class="period-value">{{ employeeDetail.cycle.label }}</div>
          </div>

          <!-- 근무 요약 -->
          <div class="work-summary">
            <div class="summary-card">
              <div class="card-label">근무 시간</div>
              <div class="card-value">{{ formatMinutes(employeeDetail.workedMinutes || 0) }}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">근무 일수</div>
              <div class="card-value">{{ employeeDetail.daysWorked || 0 }}일</div>
            </div>
          </div>

          <div class="settlement-summary">
            <div class="summary-row">
              <span class="label">기본 급여</span>
              <span class="value">{{ formatCurrency(employeeDetail.amount || 0) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">소득세 ({{ ((calculateIncomeTax()) / Math.max(employeeDetail.amount || 1, 1) * 100).toFixed(1) }}%)</span>
              <span class="value tax">-{{ formatCurrency(calculateIncomeTax()) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">지방소득세</span>
              <span class="value tax">-{{ formatCurrency(calculateLocalIncomeTax()) }}</span>
            </div>
            <div v-if="calculateOtherTax() > 0" class="summary-row">
              <span class="label">기타 세금</span>
              <span class="value tax">-{{ formatCurrency(calculateOtherTax()) }}</span>
            </div>
            <div class="summary-row total">
              <span class="label">실 지급액</span>
              <span class="value">{{ formatCurrency(calculateNetAmount()) }}</span>
            </div>
          </div>

          <div class="confirmation-text">
            <p><strong>{{ employeeDetail.employee.name }}</strong>님의 급여를 정산하시겠습니까?</p>
            <p class="note">정산 후에는 취소할 수 없습니다.</p>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="handleClose" class="btn btn-secondary">
            취소
          </button>
          <button @click="handleConfirm" :disabled="processLoading || !employeeDetail" class="btn btn-primary">
            <span v-if="processLoading">처리 중...</span>
            <span v-else>정산 확인</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { usePayrollStore } from '@/stores/payroll'

export default {
  name: 'EmployeeSettlementModal',
  components: {
    AppIcon
  },
  props: {
    employeeId: {
      type: [String, Number],
      required: true
    },
    year: {
      type: Number,
      default: () => new Date().getFullYear()
    },
    month: {
      type: Number,
      default: () => new Date().getMonth() + 1
    },
    processLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const payrollStore = usePayrollStore()
    const employeeDetail = ref(null)
    const loading = ref(false)
    const error = ref(null)
    const handleConfirm = () => {
      if (employeeDetail.value) {
        emit('confirm', {
          employeeId: props.employeeId,
          year: props.year,
          month: props.month,
          employeeDetail: employeeDetail.value
        })
      }
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

    const calculateIncomeTax = () => {
      const amount = employeeDetail.value?.amount || 0
      return Math.round(amount * 0.033) // 3.3% 소득세
    }

    const calculateLocalIncomeTax = () => {
      const incomeTax = calculateIncomeTax()
      return Math.round(incomeTax * 0.1) // 소득세의 10%
    }

    const calculateOtherTax = () => {
      // 기타 세금은 일반적으로 0으로 설정
      return 0
    }

    const calculateNetAmount = () => {
      const amount = employeeDetail.value?.amount || 0
      const incomeTax = calculateIncomeTax()
      const localIncomeTax = calculateLocalIncomeTax()
      const otherTax = calculateOtherTax()
      return Math.max(0, amount - incomeTax - localIncomeTax - otherTax)
    }

    const fetchEmployeeData = async () => {
      if (!props.employeeId) return

      loading.value = true
      error.value = null

      try {
        const data = await payrollStore.fetchEmployeePayrollDetail(
          props.employeeId,
          props.year,
          props.month
        )
        employeeDetail.value = data
      } catch (err) {
        console.error('Failed to fetch employee payroll detail:', err)
        error.value = err.message || '직원 정산 정보를 불러오는데 실패했습니다.'
      } finally {
        loading.value = false
      }
    }

    // Watch for changes in props to refetch data
    watch([() => props.employeeId, () => props.year, () => props.month], () => {
      fetchEmployeeData()
    }, { immediate: false })

    onMounted(() => {
      fetchEmployeeData()
    })

    return {
      employeeDetail,
      loading,
      error,
      handleConfirm,
      handleClose,
      handleBackdropClick,
      formatCurrency,
      formatPosition,
      formatMinutes,
      calculateIncomeTax,
      calculateLocalIncomeTax,
      calculateOtherTax,
      calculateNetAmount,
      getEmployeeColor,
      fetchEmployeeData
    }
  }
}
</script>

<style scoped src="@/assets/styles/admin/EmployeeSettlementModal.css"></style>
