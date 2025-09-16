<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="user" :size="18" class="inline-block mr-2" />
          {{ employeeDetail?.employee?.name }}님 급여 상세
        </h3>
        <button @click="handleClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="loading" class="loading-section">
          <div class="loading-spinner"></div>
          <p>상세 정보를 불러오는 중...</p>
        </div>

        <div v-else-if="error" class="error-section">
          <div class="error-icon"><AppIcon name="warning" :size="48" /></div>
          <h4>오류가 발생했습니다</h4>
          <p>{{ error }}</p>
        </div>

        <div v-else-if="employeeDetail" class="detail-content">
          <!-- 직원 기본 정보 -->
          <div class="employee-summary">
            <div 
              class="employee-avatar" 
              :style="{ backgroundColor: getEmployeeColor(employeeDetail.employee) }"
            >
              {{ employeeDetail.employee.name.charAt(0) }}
            </div>
            <div class="employee-info">
              <h4>{{ employeeDetail.employee.name }}</h4>
              <p>{{ formatPosition(employeeDetail.employee.position) }}</p>
              <div class="pay-info">
                <span class="pay-type">{{ employeeDetail.employee.payUnit === 'HOURLY' ? '시급' : '월급' }}</span>
                <span class="pay-amount">{{ formatCurrency(employeeDetail.employee.pay) }}</span>
              </div>
            </div>
          </div>

          <!-- 정산 기간 -->
          <div class="period-info">
            <div class="period-label">정산 기간</div>
            <div class="period-value">{{ employeeDetail.cycle?.label }}</div>
          </div>

          <!-- 급여 요약 -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="card-label">총 급여</div>
              <div class="card-value primary">{{ formatCurrency(employeeDetail.amount) }}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">근무 시간</div>
              <div class="card-value">{{ formatMinutes(employeeDetail.workedMinutes) }}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">근무 일수</div>
              <div class="card-value">{{ employeeDetail.daysWorked }}일</div>
            </div>
            <div class="summary-card">
              <div class="card-label">정산 상태</div>
              <div class="card-value" :class="getSettlementStatusClass(employeeDetail.settlement)">
                {{ getSettlementStatusText(employeeDetail.settlement) }}
              </div>
            </div>
          </div>

          <!-- 근무 기록 -->
          <div v-if="employeeDetail.logs && employeeDetail.logs.length > 0" class="work-logs">
            <h5>근무 기록</h5>
            <div class="logs-container">
              <div v-for="log in employeeDetail.logs" :key="log.id" class="log-item">
                <div class="log-date">{{ formatDate(log.date) }}</div>
                <div class="log-time">
                  <span class="planned">{{ formatTime(log.plannedStart) }} - {{ formatTime(log.plannedEnd) }}</span>
                  <span class="actual">
                    {{ log.actualInAt ? formatTime(log.actualInAt) : '미기록' }} - 
                    {{ log.actualOutAt ? formatTime(log.actualOutAt) : '미기록' }}
                  </span>
                </div>
                <div class="log-amount">{{ formatCurrency(log.finalPayAmount) }}</div>
                <div class="log-status" :class="getLogStatusClass(log.status)">
                  {{ formatLogStatus(log.status) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="handleClose" class="btn btn-primary">
            닫기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppIcon from '@/components/common/AppIcon.vue'

export default {
  name: 'EmployeeDetailModal',
  components: {
    AppIcon
  },
  props: {
    employeeDetail: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
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
      if (!minutes) return '0시간'
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })
    }

    const formatTime = (dateString) => {
      return new Date(dateString).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
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

    const getSettlementStatusClass = (settlement) => {
      if (!settlement || settlement.status === 'PENDING') return 'pending'
      if (settlement.status === 'PAID') return 'paid'
      return 'pending'
    }

    const getSettlementStatusText = (settlement) => {
      if (!settlement || settlement.status === 'PENDING') return '정산 대기'
      if (settlement.status === 'PAID') return '정산 완료'
      return '정산 대기'
    }

    const getLogStatusClass = (status) => {
      if (status === 'COMPLETED') return 'completed'
      if (status === 'PENDING') return 'pending'
      return 'normal'
    }

    const formatLogStatus = (status) => {
      const statuses = {
        'COMPLETED': '완료',
        'PENDING': '대기',
        'CANCELLED': '취소'
      }
      return statuses[status] || status
    }

    return {
      handleClose,
      handleBackdropClick,
      formatCurrency,
      formatMinutes,
      formatDate,
      formatTime,
      formatPosition,
      getEmployeeColor,
      getSettlementStatusClass,
      getSettlementStatusText,
      getLogStatusClass,
      formatLogStatus
    }
  }
}
</script>

<style scoped src="@/assets/styles/components/AdminPayrollView/AdminEmployeeDetailModal.css"></style>
