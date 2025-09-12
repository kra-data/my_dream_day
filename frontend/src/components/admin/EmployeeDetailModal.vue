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
import AppIcon from '@/components/AppIcon.vue'

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
  max-width: 700px;
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

.loading-section, .error-section {
  text-align: center;
  padding: 40px 20px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.employee-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.employee-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 24px;
  flex-shrink: 0;
}

.employee-info h4 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.employee-info p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #6b7280;
}

.pay-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pay-type {
  background: #e5e7eb;
  color: #374151;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.pay-amount {
  font-weight: 600;
  color: #1f2937;
}

.period-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 20px;
}

.period-label {
  font-size: 14px;
  color: #0369a1;
  font-weight: 500;
}

.period-value {
  font-weight: 600;
  color: #0c4a6e;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: center;
}

.card-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.card-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.card-value.primary {
  color: #3b82f6;
}

.card-value.pending {
  color: #f59e0b;
}

.card-value.paid {
  color: #10b981;
}

.work-logs h5 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: grid;
  grid-template-columns: 80px 1fr 80px 60px;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.log-date {
  font-weight: 500;
  color: #374151;
}

.log-time {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.planned {
  color: #6b7280;
  font-size: 12px;
}

.actual {
  color: #1f2937;
  font-weight: 500;
}

.log-amount {
  text-align: right;
  font-weight: 600;
  color: #3b82f6;
}

.log-status {
  text-align: center;
  font-size: 12px;
  font-weight: 500;
}

.log-status.completed {
  color: #10b981;
}

.log-status.pending {
  color: #f59e0b;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 20px;
  }
  
  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .log-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>