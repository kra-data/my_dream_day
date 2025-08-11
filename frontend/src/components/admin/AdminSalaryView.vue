<template>
  <div class="tab-content">
    <div class="payroll-section">
      <!-- 급여 대시보드 -->
      <div class="payroll-dashboard">
        <div class="section-header">
          <h2>💰 급여 관리</h2>
          <div class="month-selector">
            <select v-model="selectedYear" @change="fetchPayrollData">
              <option v-for="year in availableYears" :key="year" :value="year">
                {{ year }}년
              </option>
            </select>
            <select v-model="selectedMonth" @change="fetchPayrollData">
              <option v-for="month in 12" :key="month" :value="month">
                {{ month }}월
              </option>
            </select>
          </div>
        </div>

        <!-- 급여 통계 카드 -->
        <div class="payroll-stats">
          <div class="stat-card">
            <div class="stat-icon">💵</div>
            <div class="stat-content">
              <span class="stat-number">{{ salaryStore.formatSalary(salaryStore.payrollDashboard.expectedExpense) }}</span>
              <span class="stat-label">이번달 예상 지출</span>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <span class="stat-number">{{ salaryStore.formatSalary(salaryStore.payrollDashboard.lastMonthExpense) }}</span>
              <span class="stat-label">지난달 지출</span>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <span class="stat-number">{{ salaryStore.payrollDashboard.employeeCount }}</span>
              <span class="stat-label">급여 대상 직원</span>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">⏰</div>
            <div class="stat-content">
              <span class="stat-number">{{ salaryStore.formatWorkDuration(salaryStore.payrollDashboard.totalWorkedMinutes) }}</span>
              <span class="stat-label">총 근무 시간</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 직원별 급여 목록 -->
      <div class="employee-payroll-list">
        <h3>직원별 급여 현황</h3>
        <div class="payroll-table">
          <table>
            <thead>
              <tr>
                <th>직원명</th>
                <th>직위</th>
                <th>급여 형태</th>
                <th>기본 급여</th>
                <th>근무 시간</th>
                <th>추가 근무</th>
                <th>총 급여</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="salaryStore.employeePayrolls.length === 0">
                <td colspan="8" class="no-data">급여 데이터가 없습니다</td>
              </tr>
              <tr v-else v-for="employee in salaryStore.employeePayrolls" :key="employee.employeeId">
                <td>
                  <div class="employee-cell">
                    <div class="employee-avatar">
                      {{ employee.name.charAt(0) }}
                    </div>
                    {{ employee.name }}
                  </div>
                </td>
                <td>{{ formatPosition(employee.position) }}</td>
                <td>
                  <span class="pay-type">
                    {{ employee.hourlyPay ? '시급' : '월급' }}
                  </span>
                </td>
                <td>
                  {{ employee.hourlyPay 
                    ? `${employee.hourlyPay.toLocaleString()}원/시간` 
                    : `${employee.monthlyPay.toLocaleString()}원/월` 
                  }}
                </td>
                <td>{{ salaryStore.formatWorkDuration(employee.workedMinutes) }}</td>
                <td>{{ salaryStore.formatWorkDuration(employee.extraMinutes) }}</td>
                <td class="salary-amount">{{ salaryStore.formatSalary(employee.salary) }}</td>
                <td>
                  <button 
                    @click="viewEmployeePayrollDetail(employee.employeeId)"
                    class="btn btn-secondary btn-sm"
                  >
                    상세보기
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 급여 상세 모달 -->
    <div v-if="showPayrollDetailModal" class="modal-overlay" @click="closePayrollDetailModal">
      <div class="modal-content payroll-detail-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ salaryStore.employeeDetail?.employee?.name }}님 급여 상세</h3>
          <button @click="closePayrollDetailModal" class="modal-close">&times;</button>
        </div>
        <div v-if="salaryStore.employeeDetail" class="payroll-detail">
          <div class="detail-summary">
            <div class="summary-item">
              <span class="label">근무 일수:</span>
              <span class="value">{{ salaryStore.employeeDetail.daysWorked }}일</span>
            </div>
            <div class="summary-item">
              <span class="label">총 근무시간:</span>
              <span class="value">{{ salaryStore.formatWorkDuration(salaryStore.employeeDetail.workedMinutes) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">추가 근무시간:</span>
              <span class="value">{{ salaryStore.formatWorkDuration(salaryStore.employeeDetail.extraMinutes) }}</span>
            </div>
            <div class="summary-item total">
              <span class="label">총 급여:</span>
              <span class="value">{{ salaryStore.formatSalary(salaryStore.employeeDetail.salary) }}</span>
            </div>
          </div>

          <div class="detail-logs">
            <h4>출퇴근 기록</h4>
            <div class="logs-table">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>출근시간</th>
                    <th>퇴근시간</th>
                    <th>근무시간</th>
                    <th>추가근무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!salaryStore.employeeDetail.logs || salaryStore.employeeDetail.logs.length === 0">
                    <td colspan="5" class="no-data">출퇴근 기록이 없습니다</td>
                  </tr>
                  <tr v-else v-for="log in salaryStore.employeeDetail.logs" :key="log.date">
                    <td>{{ formatDate(log.date) }}</td>
                    <td>{{ log.clockInAt ? formatTime(log.clockInAt) : '-' }}</td>
                    <td>{{ log.clockOutAt ? formatTime(log.clockOutAt) : '-' }}</td>
                    <td>{{ salaryStore.formatWorkDuration(log.workedMinutes) }}</td>
                    <td>{{ salaryStore.formatWorkDuration(log.extraMinutes) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useSalaryStore } from '@/stores/salary'

export default {
  name: 'AdminSalaryView',
  setup() {
    const salaryStore = useSalaryStore()
    
    // 급여 관련 상태
    const currentDate = new Date()
    const selectedYear = ref(currentDate.getFullYear())
    const selectedMonth = ref(currentDate.getMonth() + 1)
    const showPayrollDetailModal = ref(false)
    
    // 사용 가능한 연도 목록 (현재 연도부터 3년 전까지)
    const availableYears = computed(() => {
      const current = new Date().getFullYear()
      return Array.from({ length: 4 }, (_, i) => current - i)
    })
    
    // 급여 데이터 가져오기
    const fetchPayrollData = async () => {
      try {
        await Promise.all([
          salaryStore.fetchPayrollDashboard(selectedYear.value, selectedMonth.value),
          salaryStore.fetchEmployeePayrolls(selectedYear.value, selectedMonth.value)
        ])
      } catch (error) {
        console.error('급여 데이터 로딩 실패:', error)
      }
    }
    
    // 직원 급여 상세 보기
    const viewEmployeePayrollDetail = async (employeeId) => {
      try {
        await salaryStore.fetchEmployeePayrollDetail(employeeId, selectedYear.value, selectedMonth.value)
        showPayrollDetailModal.value = true
      } catch (error) {
        alert('급여 상세 정보를 불러오는데 실패했습니다: ' + error.message)
      }
    }
    
    // 급여 상세 모달 닫기
    const closePayrollDetailModal = () => {
      showPayrollDetailModal.value = false
      salaryStore.employeeDetail = null
    }
    
    return {
      salaryStore,
      selectedYear,
      selectedMonth,
      availableYears,
      showPayrollDetailModal,
      fetchPayrollData,
      viewEmployeePayrollDetail,
      closePayrollDetailModal
    }
  },
  methods: {
    formatPosition(position) {
      const positions = {
        'OWNER': '점장',
        'MANAGER': '매니저',
        'STAFF': '직원',
        'PART_TIME': '알바'
      }
      return positions[position] || position
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString('ko-KR')
    }
  }
}
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.payroll-section {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.payroll-dashboard {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  color: #1f2937;
  margin: 0;
}

.month-selector {
  display: flex;
  gap: 12px;
}

.month-selector select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
}

.payroll-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background: #f8fafc;
  border-left: 4px solid #e5e7eb;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  font-size: 0.9rem;
  color: #6b7280;
}

.employee-payroll-list {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.employee-payroll-list h3 {
  margin-bottom: 20px;
  color: #1f2937;
}

.payroll-table {
  overflow-x: auto;
}

.payroll-table table {
  width: 100%;
  border-collapse: collapse;
}

.payroll-table th,
.payroll-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.payroll-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

.employee-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.employee-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.pay-type {
  display: inline-block;
  padding: 4px 8px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.salary-amount {
  font-weight: 700;
  color: #059669;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

/* 급여 상세 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.payroll-detail-modal {
  max-width: 800px;
  max-height: 90vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}

.payroll-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.summary-item.total {
  grid-column: span 2;
  background: #ecfdf5;
  border: 2px solid #10b981;
}

.summary-item .label {
  font-weight: 600;
  color: #374151;
}

.summary-item .value {
  font-weight: 700;
  color: #1f2937;
}

.summary-item.total .value {
  color: #059669;
  font-size: 1.2rem;
}

.detail-logs h4 {
  margin-bottom: 16px;
  color: #1f2937;
}

.logs-table {
  overflow-x: auto;
}

.logs-table table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table th,
.logs-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.logs-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

@media (max-width: 1024px) {
  .payroll-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .detail-summary {
    grid-template-columns: 1fr;
  }
  
  .summary-item.total {
    grid-column: span 1;
  }
}

@media (max-width: 768px) {
  .payroll-stats {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .month-selector {
    flex-direction: column;
  }
  
  .payroll-table {
    overflow-x: auto;
  }
}
</style>