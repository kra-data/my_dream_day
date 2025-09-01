<template>
  <div class="payroll-management">
    <!-- 헤더 섹션 -->
    <div class="payroll-header">
      <div class="header-content">
        <h2>💰 급여 관리</h2>
        <p>직원들의 급여 현황을 관리하고 정산을 진행하세요</p>
      </div>
      
      <div class="header-actions">
        <!-- 월별 선택기 -->
        <div class="date-selector">
          <select 
            v-model="selectedYear" 
            @change="onDateChange" 
            :disabled="payrollStore.loading || isLoadingData"
            class="date-select"
          >
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}년
            </option>
          </select>
          <select 
            v-model="selectedMonth" 
            @change="onDateChange" 
            :disabled="payrollStore.loading || isLoadingData"
            class="date-select"
          >
            <option v-for="month in 12" :key="month" :value="month">
              {{ month }}월
            </option>
          </select>
        </div>

        <!-- 액션 버튼들 -->
        <div class="action-buttons">
          <button 
            @click="exportExcel"
            :disabled="payrollStore.loading || isLoadingData"
            class="btn btn-secondary"
            title="급여 데이터를 엑셀로 다운로드"
          >
            <span class="btn-icon">📊</span>
            엑셀 다운로드
          </button>
          
          <button 
            @click="refreshData"
            :disabled="payrollStore.loading || isLoadingData"
            class="btn btn-outline"
            title="데이터 새로고침"
          >
            <span class="btn-icon" :class="{ 'rotate': payrollStore.loading || isLoadingData }">🔄</span>
            새로고침
          </button>
        </div>
      </div>
      
      <!-- 로딩 인디케이터 -->
      <div v-if="payrollStore.loading || isLoadingData" class="loading-bar">
        <div class="loading-progress"></div>
      </div>
    </div>

    <!-- 대시보드 통계 -->
    <div class="dashboard-stats">
      <div class="stat-card primary">
        <div class="stat-icon">💵</div>
        <div class="stat-content">
          <h3>{{ formatCurrency(payrollStore.payrollDashboard.expectedExpense) }}</h3>
          <p>이번달 예상 지출</p>
          <span class="stat-change" :class="getChangeClass(monthlyChange)">
            {{ formatChange(monthlyChange) }}
          </span>
        </div>
      </div>
      
      <div class="stat-card success">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <h3>{{ payrollStore.payrollDashboard.employeeCount }}</h3>
          <p>급여 대상 직원</p>
          <span class="stat-label">활성 직원</span>
        </div>
      </div>
      
      <div class="stat-card info">
        <div class="stat-icon">⏰</div>
        <div class="stat-content">
          <h3>{{ formatWorkHours(payrollStore.payrollDashboard.totalWorkedMinutes) }}</h3>
          <p>총 근무 시간</p>
          <span class="stat-label">이번달 누적</span>
        </div>
      </div>
      
      <div class="stat-card warning">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <h3>{{ formatCurrency(payrollStore.payrollDashboard.lastMonthExpense) }}</h3>
          <p>지난달 지출</p>
          <span class="stat-label">비교 기준</span>
        </div>
      </div>
    </div>

    <!-- 정산 관리 섹션 -->
    <div class="settlement-section">
      <div class="section-header">
        <h3>💼 정산 관리 (7일 기준)</h3>
        <div class="settlement-info">
          <span class="settlement-period">{{ currentSettlementPeriod }}</span>
          <span class="settlement-status" :class="settlementStatusClass">
            {{ settlementStatusText }}
          </span>
        </div>
      </div>

      <div class="settlement-content">
        <div class="settlement-summary">
          <div class="summary-item">
            <span class="label">정산 대상 금액</span>
            <span class="value amount">{{ formatCurrency(totalSettlementAmount) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">미정산 직원</span>
            <span class="value count pending">{{ unsettledEmployeeCount }}명</span>
          </div>
          <div class="summary-item">
            <span class="label">정산 완료 직원</span>
            <span class="value count settled">{{ settledEmployeeCount }}명</span>
          </div>
          <div class="summary-item">
            <span class="label">정산 예정일</span>
            <span class="value date">{{ nextSettlementDate }}</span>
          </div>
        </div>

        <div class="settlement-actions">
          <button 
            @click="processSettlement"
            :disabled="payrollStore.loading || isLoadingData || totalSettlementAmount === 0"
            class="btn btn-primary btn-large"
          >
            <span v-if="payrollStore.loading || isLoadingData" class="btn-loading">
              <span class="loading-spinner"></span>
              처리중...
            </span>
            <span v-else class="btn-content">
              <span class="btn-icon">💰</span>
              정산 처리하기
            </span>
          </button>
          
        </div>
      </div>
    </div>

    <!-- 직원별 급여 테이블 -->
    <div class="payroll-table-section">
      <div class="section-header">
        <h3>직원별 급여 현황</h3>
        <div class="table-controls">
          <div class="search-box">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="직원명 검색..."
              class="search-input"
            >
            <span class="search-icon">🔍</span>
          </div>
          <div class="filter-controls">
            <select v-model="positionFilter" class="filter-select">
              <option value="">모든 직위</option>
              <option value="OWNER">점장</option>
              <option value="MANAGER">매니저</option>
              <option value="STAFF">직원</option>
              <option value="PART_TIME">알바</option>
            </select>
            <select v-model="settlementFilter" class="filter-select">
              <option value="">모든 정산상태</option>
              <option value="PAID">정산 완료</option>
              <option value="PENDING">정산 전</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-container">
        <div v-if="payrollStore.loading || isLoadingData" class="table-loading">
          <div class="loading-skeleton">
            <div v-for="n in 5" :key="n" class="skeleton-row">
              <div class="skeleton-cell"></div>
              <div class="skeleton-cell"></div>
              <div class="skeleton-cell"></div>
              <div class="skeleton-cell"></div>
            </div>
          </div>
        </div>

        <div v-else-if="filteredPayrolls.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <h4>급여 데이터가 없습니다</h4>
          <p>{{ selectedYear }}년 {{ selectedMonth }}월의 급여 데이터가 없습니다.</p>
          <!-- 디버깅 정보 -->
          <div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px; font-size: 12px; color: #6b7280;">
            <div>전체 데이터: {{ payrollStore.employeePayrolls?.length || 0 }}건</div>
            <div>필터된 데이터: {{ filteredPayrolls.length }}건</div>
            <div>검색어: "{{ searchQuery }}"</div>
            <div>직위 필터: "{{ positionFilter }}"</div>
          </div>
        </div>

        <table v-else class="payroll-table">
          <thead>
            <tr>
              <th class="sortable" @click="sortBy('name')">
                직원명
                <span class="sort-icon" :class="getSortIcon('name')">↕️</span>
              </th>
              <th>직위</th>
              <th>급여 형태</th>
              <th class="sortable" @click="sortBy('salary')" style="text-align: right;">
                급여액
                <span class="sort-icon" :class="getSortIcon('salary')">↕️</span>
              </th>
              <th style="text-align: right;">근무시간</th>
              <th style="text-align: right;">추가근무</th>
              <th style="text-align: center;">정산상태</th>
              <th class="actions">관리</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="employee in paginatedPayrolls" 
              :key="employee.employeeId"
              class="table-row"
              :class="{ 
                'settled-row': employee.settlement?.status === 'PAID',
                'pending-row': !employee.settlement || employee.settlement.status === 'PENDING'
              }"
              @click="viewEmployeeDetail(employee.employeeId)"
            >
              <td class="employee-cell">
                <div class="employee-info">
                  <div class="employee-avatar">
                    {{ getInitial(employee.name) }}
                  </div>
                  <div class="employee-details">
                    <span class="employee-name">{{ employee.name }}</span>
                    <span class="employee-id">ID: {{ employee.employeeId }}</span>
                  </div>
                </div>
              </td>
              
              <td>
                <span class="position-badge" :class="getPositionClass(employee.position)">
                  {{ formatPosition(employee.position) }}
                </span>
              </td>
              
              <td>
                <span class="pay-type-badge" :class="employee.hourlyPay ? 'hourly' : 'monthly'">
                  {{ employee.hourlyPay ? '시급' : '월급' }}
                </span>
                <div class="pay-rate">
                  {{ formatPayRate(employee) }}
                </div>
              </td>
              
              <td class="amount-cell">
                <span class="salary-amount">{{ formatCurrency(employee.salary) }}</span>
                <div class="salary-breakdown">
                  <span v-if="employee.extraMinutes > 0" class="overtime">
                    (+{{ formatCurrency(calculateOvertimePay(employee)) }} 연장)
                  </span>
                </div>
              </td>
              
              <td class="time-cell">
                <span class="work-time">{{ formatMinutes(employee.workedMinutes) }}</span>
                <div class="work-days">{{ employee.daysWorked || calculateWorkDays(employee.workedMinutes) }}일</div>
              </td>
              
              <td class="time-cell">
                <span class="overtime-hours" :class="{ 'has-overtime': employee.extraMinutes > 0 }">
                  {{ formatMinutes(employee.extraMinutes) }}
                </span>
              </td>
              
              <td class="settlement-status-cell" style="text-align: center;">
                <div class="settlement-status-badge" :class="getSettlementStatusClass(employee)">
                  <span class="status-icon">{{ getSettlementStatusIcon(employee) }}</span>
                  <span class="status-text">{{ getSettlementStatusText(employee) }}</span>
                </div>
                <div v-if="employee.settlement?.settledAt" class="settlement-date">
                  <small>{{ formatDate(employee.settlement.settledAt) }}</small>
                </div>
              </td>
              
              <td class="actions-cell">
                <div class="action-buttons">
                  <button 
                    @click.stop="viewEmployeeDetail(employee.employeeId)"
                    class="btn btn-sm btn-outline"
                    title="상세 정보 보기"
                  >
                    상세
                  </button>
                  <button 
                    @click.stop="processIndividualSettlement(employee)"
                    class="btn btn-sm"
                    :class="employee.settlement?.status === 'PAID' ? 'btn-secondary' : 'btn-success'"
                    :disabled="payrollStore.loading || employee.salary === 0 || employee.settlement?.status === 'PAID'"
                    :title="employee.settlement?.status === 'PAID' ? '정산 완료됨' : '개별 정산 처리'"
                  >
                    <span v-if="payrollStore.loading && settlingEmployeeId === employee.employeeId">
                      처리중...
                    </span>
                    <span v-else-if="employee.settlement?.status === 'PAID'">
                      완료
                    </span>
                    <span v-else>정산</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 페이지네이션 -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="pagination-btn"
          >
            ← 이전
          </button>
          
          <div class="pagination-info">
            <span>{{ currentPage }} / {{ totalPages }}</span>
            <span class="total-count">(총 {{ filteredPayrolls.length }}건)</span>
          </div>
          
          <button 
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="pagination-btn"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>

    <!-- 직원 상세 모달 -->
    <div v-if="showDetailModal" class="modal-overlay" @click="closeDetailModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>{{ payrollStore.employeeDetail?.employee?.name || selectedEmployee?.name || '직원' }}님 급여 상세</h3>
          <button @click="closeDetailModal" class="modal-close">&times;</button>
        </div>

        <div v-if="payrollStore.loading" class="modal-loading">
          <div class="loading-spinner large"></div>
          <p>상세 정보를 불러오는 중...</p>
        </div>

        <div v-else-if="payrollStore.error" class="modal-error">
          <div class="error-icon">⚠️</div>
          <h4>오류가 발생했습니다</h4>
          <p>{{ payrollStore.error }}</p>
          <button @click="closeDetailModal" class="btn btn-primary">확인</button>
        </div>
        
        <div v-else-if="payrollStore.employeeDetail" class="modal-content">
          <!-- 요약 정보 -->
          <div class="detail-summary">
            <!-- 정산 정보 표시 (단순화) -->
            <div class="settlement-info-card" :class="payrollStore.employeeDetail.settlementStatus === 'PENDING' ? 'pending' : ''">
              <div class="settlement-header">
                <h4>정산 정보</h4>
                <div class="settlement-status-badge" :class="payrollStore.employeeDetail.settlementStatus === 'PAID' ? 'settled' : 'pending'">
                  <span class="status-icon">
                    {{ payrollStore.employeeDetail.settlementStatus === 'PAID' ? '✅' : '⏳' }}
                  </span>
                  <span class="status-text">
                    {{ payrollStore.employeeDetail.settlementStatus === 'PAID' ? '정산 완료' : '정산 대기' }}
                  </span>
                </div>
              </div>
              
              <div class="settlement-details">
                <div v-if="payrollStore.employeeDetail.settlement && payrollStore.employeeDetail.settlement.id" class="settlement-detail-row">
                  <span class="label">정산 ID:</span>
                  <span class="value settlement-id">#{{ payrollStore.employeeDetail.settlement.id }}</span>
                </div>
                
                <div v-if="payrollStore.employeeDetail.settlement && payrollStore.employeeDetail.settlement.totalPay" class="settlement-detail-row">
                  <span class="label">정산 금액:</span>
                  <span class="value amount">{{ formatCurrency(payrollStore.employeeDetail.settlement.totalPay) }}</span>
                </div>
                
                <div v-if="payrollStore.employeeDetail.settlement && payrollStore.employeeDetail.settlement.settledAt" class="settlement-detail-row">
                  <span class="label">정산 일자:</span>
                  <span class="value date">{{ formatDate(payrollStore.employeeDetail.settlement.settledAt) }}</span>
                </div>
                
                <div v-if="payrollStore.employeeDetail.settlementStatus === 'PENDING'" class="settlement-detail-row">
                  <span class="notice">이 직원의 급여는 아직 정산되지 않았습니다.</span>
                </div>
                
                <div class="settlement-detail-row">
                  <span class="label">{{ payrollStore.employeeDetail.settlementStatus === 'PAID' ? '정산 금액' : '예상 정산 금액' }}:</span>
                  <span class="value amount" :class="payrollStore.employeeDetail.settlementStatus === 'PENDING' ? 'pending' : ''">{{ formatCurrency(payrollStore.employeeDetail.expectedSalary) }}</span>
                </div>
              </div>
            </div>

            <!-- 급여 기간 정보 -->
            <div v-if="payrollStore.employeeDetail.cycle" class="cycle-info-card">
              <h4>급여 산정 기간 ({{ payrollStore.employeeDetail.year }}년 {{ payrollStore.employeeDetail.month }}월)</h4>
              <div class="cycle-details">
                <div class="cycle-dates">
                  <small>{{ formatDate(payrollStore.employeeDetail.cycle.start) }} ~ {{ formatDate(payrollStore.employeeDetail.cycle.end) }}</small>
                </div>
              </div>
            </div>

            <div class="summary-grid">
              <div class="summary-card">
                <span class="summary-label">근무 일수</span>
                <span class="summary-value">{{ payrollStore.employeeDetail.daysWorked }}일</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">총 근무시간</span>
                <span class="summary-value">{{ formatMinutes(payrollStore.employeeDetail.workedMinutes) }}</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">연장 근무시간</span>
                <span class="summary-value overtime">{{ formatMinutes(payrollStore.employeeDetail.extraMinutes) }}</span>
              </div>
              <div class="summary-card total">
                <span class="summary-label">예상 급여</span>
                <span class="summary-value">{{ formatCurrency(payrollStore.employeeDetail.expectedSalary) }}</span>
              </div>
            </div>
            
            <!-- 추가 정보 카드 -->
            <div v-if="payrollStore.employeeDetail.employee" class="employee-extra-info">
              <div class="info-grid">
                <div class="info-card">
                  <span class="info-label">급여 형태</span>
                  <span class="info-value">
                    {{ payrollStore.employeeDetail.employee.hourlyPay ? '시급제' : '월급제' }}
                  </span>
                </div>
                <div class="info-card">
                  <span class="info-label">기본급</span>
                  <span class="info-value">
                    {{ payrollStore.employeeDetail.employee.hourlyPay 
                        ? formatCurrency(payrollStore.employeeDetail.employee.hourlyPay) + '/시간'
                        : formatCurrency(payrollStore.employeeDetail.employee.monthlyPay) + '/월'
                    }}
                  </span>
                </div>
                <div class="info-card">
                  <span class="info-label">직위</span>
                  <span class="info-value">{{ formatPosition(payrollStore.employeeDetail.employee.position) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 출퇴근 기록 -->
          <div class="attendance-logs">
            <h4>출퇴근 기록</h4>
            <div v-if="!payrollStore.employeeDetail.logs || payrollStore.employeeDetail.logs.length === 0" class="no-logs">
              <span class="empty-icon">📅</span>
              <p>출퇴근 기록이 없습니다.</p>
              <div class="summary-info">
                <div class="summary-row">
                  <span class="label">총 근무시간:</span>
                  <span class="value">{{ formatMinutes(payrollStore.employeeDetail.workedMinutes) }}</span>
                </div>
                <div class="summary-row">
                  <span class="label">연장근무시간:</span>
                  <span class="value overtime">{{ formatMinutes(payrollStore.employeeDetail.extraMinutes) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="logs-table-container">
              <table class="logs-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>출근시간</th>
                    <th>퇴근시간</th>
                    <th>근무시간</th>
                    <th>연장시간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in payrollStore.employeeDetail.logs" :key="log.date">
                    <td>{{ formatDate(log.date) }}</td>
                    <td>{{ log.clockInAt ? formatTime(log.clockInAt) : '-' }}</td>
                    <td>{{ log.clockOutAt ? formatTime(log.clockOutAt) : '-' }}</td>
                    <td>{{ formatMinutes(log.workedMinutes) }}</td>
                    <td class="overtime-cell">{{ formatMinutes(log.extraMinutes) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 알림 토스트 -->
    <div v-if="notification.show" class="notification-toast" :class="notification.type">
      <span class="notification-icon">
        {{ notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️' }}
      </span>
      <span class="notification-message">{{ notification.message }}</span>
      <button @click="hideNotification" class="notification-close">&times;</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { usePayrollStore } from '@/stores/payroll'

export default {
  name: 'AdminSalaryView',
  setup() {
    const payrollStore = usePayrollStore()
    
    // 상태 관리
    const isLoadingData = ref(false)
    const selectedYear = ref(new Date().getFullYear())
    const selectedMonth = ref(new Date().getMonth() + 1)
    const showDetailModal = ref(false)
    const selectedEmployee = ref(null)
    const searchQuery = ref('')
    const positionFilter = ref('')
    const settlementFilter = ref('')
    const sortField = ref('name')
    const sortDirection = ref('asc')
    const currentPage = ref(1)
    const itemsPerPage = ref(10)
    const settlingEmployeeId = ref(null)
    
    let fetchTimeout = null
    
    // 알림 시스템
    const notification = ref({
      show: false,
      type: 'info',
      message: ''
    })
    
    // 계산된 속성들
    const availableYears = computed(() => {
      const current = new Date().getFullYear()
      return Array.from({ length: 4 }, (_, i) => current - i)
    })
    
    const monthlyChange = computed(() => {
      const current = payrollStore.payrollDashboard.expectedExpense || 0
      const last = payrollStore.payrollDashboard.lastMonthExpense || 0
      if (last === 0) return 0
      return ((current - last) / last * 100).toFixed(1)
    })
    
    const currentSettlementPeriod = computed(() => {
      const now = new Date()
      const currentDate = now.getDate()
      
      if (currentDate >= 7) {
        const start = new Date(now.getFullYear(), now.getMonth(), 7)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 6)
        return `${start.getMonth() + 1}월 7일 ~ ${end.getMonth() + 1}월 6일`
      } else {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 7)
        const end = new Date(now.getFullYear(), now.getMonth(), 6)
        return `${start.getMonth() + 1}월 7일 ~ ${end.getMonth() + 1}월 6일`
      }
    })
    
    const totalSettlementAmount = computed(() => {
      return payrollStore.employeePayrolls.reduce((sum, emp) => {
        // 정산 대기 중인 직원만 포함
        if (!emp.settlement || emp.settlement.status === 'PENDING') {
          return sum + (emp.salary || 0)
        }
        return sum
      }, 0)
    })
    
    const unsettledEmployeeCount = computed(() => {
      return payrollStore.employeePayrolls.filter(emp => 
        !emp.settlement || emp.settlement.status === 'PENDING'
      ).length
    })
    
    const settledEmployeeCount = computed(() => {
      return payrollStore.employeePayrolls.filter(emp => 
        emp.settlement && emp.settlement.status === 'PAID'
      ).length
    })
    
    const nextSettlementDate = computed(() => {
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 7)
      return nextMonth.toLocaleDateString('ko-KR')
    })
    
    const settlementStatusClass = computed(() => {
      const amount = totalSettlementAmount.value
      if (amount === 0) return 'completed'
      if (amount > 10000000) return 'warning'
      return 'pending'
    })
    
    const settlementStatusText = computed(() => {
      const amount = totalSettlementAmount.value
      if (amount === 0) return '정산 완료'
      if (amount > 10000000) return '고액 정산 대기'
      return '정산 대기'
    })
    
    // 필터링된 급여 목록
    const filteredPayrolls = computed(() => {
      let filtered = [...payrollStore.employeePayrolls]
      
      // 검색 필터
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(emp => 
          emp.name.toLowerCase().includes(query) ||
          emp.employeeId.toString().includes(query)
        )
      }
      
      // 직위 필터
      if (positionFilter.value) {
        filtered = filtered.filter(emp => emp.position === positionFilter.value)
      }
      
      // 정산 상태 필터
      if (settlementFilter.value) {
        if (settlementFilter.value === 'PAID') {
          filtered = filtered.filter(emp => emp.settlement && emp.settlement.status === 'PAID')
        } else if (settlementFilter.value === 'PENDING') {
          filtered = filtered.filter(emp => !emp.settlement || emp.settlement.status === 'PENDING')
        }
      }
      
      // 정렬
      filtered.sort((a, b) => {
        let aVal = a[sortField.value]
        let bVal = b[sortField.value]
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }
        
        if (sortDirection.value === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
      
      return filtered
    })
    
    const totalPages = computed(() => {
      return Math.ceil(filteredPayrolls.value.length / itemsPerPage.value)
    })
    
    const paginatedPayrolls = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return filteredPayrolls.value.slice(start, end)
    })
    
    // 메서드들
    const fetchPayrollData = async () => {
      const hasCurrentData = payrollStore.payrollDashboard && 
                           payrollStore.payrollDashboard.year === selectedYear.value && 
                           payrollStore.payrollDashboard.month === selectedMonth.value &&
                           payrollStore.employeePayrolls.length > 0
      
      if (hasCurrentData) {
        return
      }
      
      if (isLoadingData.value || payrollStore.loading) {
        return
      }
      
      isLoadingData.value = true
      try {
        
        await Promise.all([
          payrollStore.fetchPayrollDashboard(selectedYear.value, selectedMonth.value),
          new Promise(resolve => setTimeout(resolve, 200)),
          payrollStore.fetchEmployeePayrolls(selectedYear.value, selectedMonth.value)
        ])
        
        showNotification('success', '급여 데이터를 성공적으로 불러왔습니다.')
      } catch (error) {
        console.error('급여 데이터 로딩 실패:', error)
        showNotification('error', '급여 데이터를 불러오는데 실패했습니다.')
      } finally {
        isLoadingData.value = false
      }
    }
    
    const onDateChange = () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      
      fetchTimeout = setTimeout(() => {
        fetchPayrollData()
      }, 1000)
    }
    
    const refreshData = async () => {
      // 캐시 무시하고 강제 새로고침
      payrollStore.payrollDashboard.year = null
      await fetchPayrollData()
    }
    
    const exportExcel = async () => {
      try {
        showNotification('info', '엑셀 파일을 생성중입니다...')
        await payrollStore.exportPayrollExcel(selectedYear.value, selectedMonth.value)
        showNotification('success', '엑셀 파일이 다운로드되었습니다.')
      } catch (error) {
        console.error('엑셀 다운로드 실패:', error)
        showNotification('error', '엑셀 다운로드에 실패했습니다.')
      }
    }
    
    const viewEmployeeDetail = async (employeeId) => {
      // 이전 에러 상태 초기화
      payrollStore.error = null
      
      selectedEmployee.value = payrollStore.employeePayrolls.find(emp => emp.employeeId === employeeId)
      showDetailModal.value = true
      
      try {
        await payrollStore.fetchEmployeePayrollDetail(employeeId, selectedYear.value, selectedMonth.value)
      } catch (error) {
        console.error('직원 상세 정보 조회 실패:', error)
        // 에러는 payrollStore.error에 설정되어 모달에서 표시됨
      }
    }
    
    const closeDetailModal = () => {
      showDetailModal.value = false
      selectedEmployee.value = null
      payrollStore.employeeDetail = null
    }
    
    const processSettlement = async () => {
      const totalAmount = totalSettlementAmount.value
      const employeeCount = unsettledEmployeeCount.value
      
      if (totalAmount === 0) {
        showNotification('warning', '정산할 급여가 없습니다.')
        return
      }
      
      const confirmed = confirm(
        `총 ${formatCurrency(totalAmount)}을(를) ${employeeCount}명의 직원에게 정산하시겠습니까?`
      )
      
      if (!confirmed) return
      
      try {
        const settlementData = {
          period: currentSettlementPeriod.value,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          totalAmount: totalAmount,
          employees: payrollStore.employeePayrolls.map(emp => ({
            employeeId: emp.employeeId,
            name: emp.name,
            amount: emp.salary,
            workedMinutes: emp.workedMinutes,
            daysWorked: emp.daysWorked || 0
          }))
        }
        
        const result = await payrollStore.processSettlement(settlementData)
        
        if (result.success) {
          if (result.errors && result.errors.length > 0) {
            showNotification('warning', result.message)
          } else {
            showNotification('success', `정산이 완료되었습니다! (${formatCurrency(result.totalProcessedAmount || totalAmount)}, ${result.processedEmployees}명)`)
          }
          await refreshData() // 정산 후 데이터 새로고침
        }
      } catch (error) {
        console.error('정산 처리 실패:', error)
        showNotification('error', `정산 처리에 실패했습니다: ${error.message}`)
      }
    }
    
    const processIndividualSettlement = async (employee) => {
      if (!employee || employee.salary === 0) {
        showNotification('warning', '정산할 급여가 없습니다.')
        return
      }
      
      const confirmed = confirm(
        `${employee.name}님의 급여 ${formatCurrency(employee.salary)}을(를) 정산하시겠습니까?`
      )
      
      if (!confirmed) return
      
      settlingEmployeeId.value = employee.employeeId
      
      try {
        const settlementData = {
          amount: employee.salary,
          workedMinutes: employee.workedMinutes || 0,
          daysWorked: employee.daysWorked || 0,
          period: currentSettlementPeriod.value,
          settlementDate: new Date().toISOString()
        }
        
        const result = await payrollStore.processEmployeeSettlement(employee.employeeId, settlementData)
        
        if (result.success) {
          showNotification('success', `${employee.name}님 정산이 완료되었습니다! (${formatCurrency(result.processedAmount || employee.salary)})`)
          await refreshData() // 정산 후 데이터 새로고침
        } else {
          showNotification('error', result.message || '정산 처리에 실패했습니다.')
        }
      } catch (error) {
        console.error(`${employee.name} 정산 처리 실패:`, error)
        showNotification('error', `${employee.name}님 정산 처리에 실패했습니다: ${error.message}`)
      } finally {
        settlingEmployeeId.value = null
      }
    }
    
    const sortBy = (field) => {
      if (sortField.value === field) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      } else {
        sortField.value = field
        sortDirection.value = 'asc'
      }
      currentPage.value = 1
    }
    
    const showNotification = (type, message) => {
      notification.value = { show: true, type, message }
      setTimeout(() => {
        hideNotification()
      }, 5000)
    }
    
    const hideNotification = () => {
      notification.value.show = false
    }
    
    // 유틸리티 함수들
    const formatCurrency = (amount) => {
      if (!amount) return '0원'
      return `${amount.toLocaleString()}원`
    }
    
    const formatMinutes = (minutes) => {
      if (!minutes || minutes === 0) return '0시간'
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`
    }
    
    const formatWorkHours = (minutes) => {
      if (!minutes) return '0시간'
      return `${Math.round(minutes / 60)}시간`
    }
    
    const formatChange = (change) => {
      const changeNum = parseFloat(change)
      if (changeNum === 0) return '변동없음'
      return `${changeNum > 0 ? '+' : ''}${changeNum}%`
    }
    
    const getChangeClass = (change) => {
      const changeNum = parseFloat(change)
      if (changeNum > 0) return 'positive'
      if (changeNum < 0) return 'negative'
      return 'neutral'
    }
    
    const formatPayRate = (employee) => {
      if (employee.hourlyPay) {
        return `${employee.hourlyPay.toLocaleString()}원/시간`
      } else if (employee.monthlyPay) {
        return `${employee.monthlyPay.toLocaleString()}원/월`
      }
      return '미설정'
    }
    
    const calculateOvertimePay = (employee) => {
      if (!employee.hourlyPay || !employee.extraMinutes) return 0
      return Math.round(employee.hourlyPay * (employee.extraMinutes / 60) * 1.5)
    }
    
    const getInitial = (name) => {
      return name ? name.charAt(0) : '?'
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
    
    const getPositionClass = (position) => {
      const classes = {
        'OWNER': 'owner',
        'MANAGER': 'manager',
        'STAFF': 'staff', 
        'PART_TIME': 'part-time'
      }
      return classes[position] || 'default'
    }
    
    const getSortIcon = (field) => {
      if (sortField.value !== field) return ''
      return sortDirection.value === 'asc' ? 'asc' : 'desc'
    }
    
    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString('ko-KR')
    }
    
    const getAttendanceStatus = (log) => {
      if (!log.clockInAt) return 'absent'
      if (!log.clockOutAt) return 'incomplete'
      if (log.extraMinutes > 0) return 'overtime'
      return 'normal'
    }
    
    const getAttendanceStatusText = (log) => {
      const status = getAttendanceStatus(log)
      const statusTexts = {
        'absent': '결근',
        'incomplete': '미퇴근',
        'overtime': '연장근무',
        'normal': '정상'
      }
      return statusTexts[status] || '알 수 없음'
    }
    
    // 근무 일수 계산 (대략적인 추정)
    const calculateWorkDays = (workedMinutes) => {
      if (!workedMinutes) return 0
      // 하루 8시간(480분) 기준으로 계산
      return Math.round(workedMinutes / 480)
    }
    
    // 근무 분수에서 일수 계산 (더 정확한 버전)
    const calculateWorkDaysFromMinutes = (workedMinutes) => {
      if (!workedMinutes || workedMinutes === 0) return 0
      // 하루 8시간(480분) 기준으로 계산
      const days = Math.round(workedMinutes / 480)
      return days > 0 ? days : 1 // 최소 1일은 표시
    }
    
    // 정산 상태 관련 헬퍼 함수들
    const getSettlementStatusClass = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return 'settled'
      }
      return 'pending'
    }
    
    const getSettlementStatusIcon = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return '✅'
      }
      return '⏳'
    }
    
    const getSettlementStatusText = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return '정산 완료'
      }
      return '정산 전'
    }
    
    // 컴포넌트 마운트
    onMounted(() => {
      // 컴포넌트 초기화
    })
    
    // 검색어 변경시 페이지 리셋
    watch([searchQuery, positionFilter, settlementFilter], () => {
      currentPage.value = 1
    })
    
    
    return {
      // Store
      payrollStore,
      
      // State
      isLoadingData,
      selectedYear,
      selectedMonth,
      showDetailModal,
      selectedEmployee,
      searchQuery,
      positionFilter,
      settlementFilter,
      sortField,
      sortDirection,
      currentPage,
      itemsPerPage,
      settlingEmployeeId,
      notification,
      
      // Computed
      availableYears,
      monthlyChange,
      currentSettlementPeriod,
      totalSettlementAmount,
      unsettledEmployeeCount,
      settledEmployeeCount,
      nextSettlementDate,
      settlementStatusClass,
      settlementStatusText,
      filteredPayrolls,
      totalPages,
      paginatedPayrolls,
      
      // Methods
      fetchPayrollData,
      onDateChange,
      refreshData,
      exportExcel,
      viewEmployeeDetail,
      closeDetailModal,
      processSettlement,
      processIndividualSettlement,
      sortBy,
      showNotification,
      hideNotification,
      
      // Utils
      formatCurrency,
      formatMinutes,
      formatWorkHours,
      formatChange,
      getChangeClass,
      formatPayRate,
      calculateOvertimePay,
      getInitial,
      formatPosition,
      getPositionClass,
      getSortIcon,
      formatTime,
      formatDate,
      getAttendanceStatus,
      getAttendanceStatusText,
      calculateWorkDays,
      calculateWorkDaysFromMinutes,
      getSettlementStatusClass,
      getSettlementStatusIcon,
      getSettlementStatusText
    }
  }
}
</script>

<style scoped>
/* =========================
   기본 레이아웃 및 컨테이너
   ========================= */
.payroll-management {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  background: #f8fafc;
  min-height: 100vh;
}

/* =========================
   헤더 섹션
   ========================= */
.payroll-header {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
}

.header-content {
  margin-bottom: 20px;
}

.payroll-header h2 {
  color: #1f2937;
  margin: 0 0 8px 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.payroll-header p {
  color: #6b7280;
  margin: 0;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.date-selector {
  display: flex;
  gap: 12px;
}

.date-select {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  min-width: 100px;
  transition: border-color 0.2s;
}

.date-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.date-select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* 로딩 바 */
.loading-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #e5e7eb;
  overflow: hidden;
}

.loading-progress {
  height: 100%;
  background: linear-gradient(45deg, #3b82f6, #8b5cf6);
  animation: loading-slide 1.5s infinite;
}

@keyframes loading-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* =========================
   대시보드 통계
   ========================= */
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.stat-icon {
  font-size: 2.5rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.stat-card.primary .stat-icon {
  background: linear-gradient(135deg, #3b82f6, #1e40af);
  color: white;
}

.stat-card.success .stat-icon {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.stat-card.info .stat-icon {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  color: white;
}

.stat-card.warning .stat-icon {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  margin: 0 0 4px 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-content p {
  margin: 0 0 8px 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.stat-change {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.stat-change.positive {
  background: #dcfce7;
  color: #16a34a;
}

.stat-change.negative {
  background: #fef2f2;
  color: #dc2626;
}

.stat-change.neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.stat-label {
  font-size: 0.85rem;
  color: #9ca3af;
  font-weight: 500;
}

/* =========================
   정산 관리 섹션
   ========================= */
.settlement-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #10b981;
}

.settlement-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.settlement-section h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.settlement-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.settlement-period {
  font-size: 0.9rem;
  color: #059669;
  font-weight: 600;
  background: #dcfce7;
  padding: 4px 12px;
  border-radius: 20px;
}

.settlement-status {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
}

.settlement-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.settlement-status.warning {
  background: #fecaca;
  color: #991b1b;
}

.settlement-status.completed {
  background: #dcfce7;
  color: #166534;
}

.settlement-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
}

.settlement-summary {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item .label {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
}

.summary-item .value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f2937;
}

.summary-item .value.amount {
  color: #dc2626;
  font-size: 1.25rem;
}

.summary-item .value.count {
  color: #059669;
}

.summary-item .value.count.pending {
  color: #d97706;
}

.summary-item .value.count.settled {
  color: #059669;
}

.summary-item .value.date {
  color: #7c3aed;
}

.settlement-actions {
  display: flex;
  gap: 12px;
}

/* =========================
   테이블 섹션
   ========================= */
.payroll-table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.payroll-table-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.payroll-table-section h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.table-controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-box {
  position: relative;
}

.search-input {
  padding: 8px 40px 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  min-width: 200px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.filter-select {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  min-width: 120px;
}

.table-container {
  overflow-x: auto;
}

/* 로딩 스켈레톤 */
.table-loading {
  padding: 20px 0;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-row {
  display: flex;
  gap: 16px;
}

.skeleton-cell {
  height: 20px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: loading-skeleton 1.5s infinite;
  border-radius: 4px;
  flex: 1;
}

@keyframes loading-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 빈 상태 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
  color: #6b7280;
}

/* 테이블 스타일 */
.payroll-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
}

.payroll-table th {
  background: #f8fafc;
  padding: 16px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.payroll-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.payroll-table th.sortable:hover {
  background: #f1f5f9;
}

.sort-icon {
  margin-left: 4px;
  opacity: 0.5;
  font-size: 0.8rem;
}

.sort-icon.asc {
  opacity: 1;
  transform: rotate(180deg);
}

.sort-icon.desc {
  opacity: 1;
}

.payroll-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.table-row {
  transition: background-color 0.2s;
  cursor: pointer;
}

.table-row:hover {
  background: #f8fafc;
}

.table-row.settled-row {
  background: #f0fdf4;
  border-left: 3px solid #10b981;
}

.table-row.settled-row:hover {
  background: #ecfdf5;
}

.table-row.pending-row {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
}

.table-row.pending-row:hover {
  background: #fef3c7;
}

.employee-cell {
  min-width: 180px;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.employee-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.employee-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.95rem;
}

.employee-id {
  font-size: 0.8rem;
  color: #9ca3af;
}

.position-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.position-badge.owner {
  background: #fef3c7;
  color: #92400e;
}

.position-badge.manager {
  background: #dbeafe;
  color: #1e40af;
}

.position-badge.staff {
  background: #dcfce7;
  color: #166534;
}

.position-badge.part-time {
  background: #fce7f3;
  color: #be185d;
}

.pay-type-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.pay-type-badge.hourly {
  background: #ddd6fe;
  color: #5b21b6;
}

.pay-type-badge.monthly {
  background: #dcfce7;
  color: #15803d;
}

.pay-rate {
  font-size: 0.8rem;
  color: #6b7280;
}

.amount-cell {
  text-align: right;
  min-width: 120px;
}

.salary-amount {
  font-weight: 700;
  color: #059669;
  font-size: 1.05rem;
}

.salary-breakdown {
  margin-top: 4px;
}

.overtime {
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 500;
}

.time-cell {
  text-align: right;
  min-width: 100px;
}

.work-time {
  font-weight: 600;
  color: #1f2937;
}

.work-days {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 2px;
}

.overtime-hours {
  font-weight: 600;
  color: #6b7280;
}

.overtime-hours.has-overtime {
  color: #dc2626;
}

.settlement-status-cell {
  min-width: 120px;
}

.settlement-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.settlement-status-badge.settled {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #22c55e;
}

.settlement-status-badge.pending {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
}

.settlement-status-badge .status-icon {
  font-size: 1rem;
}

.settlement-date {
  margin-top: 4px;
  font-size: 0.7rem;
  color: #6b7280;
}

.actions-cell {
  text-align: center;
  min-width: 140px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 페이지네이션 */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.total-count {
  font-size: 0.8rem;
  color: #6b7280;
}

/* =========================
   버튼 스타일
   ========================= */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, #6b7280, #4b5563);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #4b5563, #374151);
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-outline {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-large {
  padding: 12px 24px;
  font-size: 16px;
}

.btn-icon {
  font-size: 1rem;
}

.btn-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rotate {
  animation: spin 1s linear infinite;
}

/* =========================
   모달
   ========================= */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: 16px;
  padding: 0;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.modal-loading {
  padding: 60px 24px;
  text-align: center;
}

.modal-loading p {
  margin: 16px 0 0;
  color: #6b7280;
}

.modal-content {
  padding: 24px;
}

.modal-error {
  padding: 40px 24px;
  text-align: center;
}

.modal-error .error-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.modal-error h4 {
  margin: 0 0 16px 0;
  color: #dc2626;
  font-size: 1.25rem;
}

.modal-error p {
  margin: 0 0 24px 0;
  color: #6b7280;
  line-height: 1.5;
}

/* 상세 요약 */
.detail-summary {
  margin-bottom: 32px;
}

/* 정산 정보 카드 */
.settlement-info-card {
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.settlement-info-card.pending {
  background: #fef3c7;
  border-color: #f59e0b;
}

.settlement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.settlement-header h4 {
  margin: 0;
  color: #0369a1;
  font-size: 1.1rem;
  font-weight: 600;
}

.settlement-info-card.pending .settlement-header h4 {
  color: #92400e;
}

.settlement-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settlement-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.settlement-detail-row:last-child {
  border-bottom: none;
}

.settlement-detail-row .label {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.settlement-detail-row .value {
  font-weight: 600;
  color: #1f2937;
}

.settlement-detail-row .value.amount {
  color: #059669;
  font-size: 1.1rem;
}

.settlement-detail-row .value.amount.pending {
  color: #d97706;
}

.settlement-detail-row .value.settlement-id {
  font-family: monospace;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
  color: #6b7280;
}

.settlement-detail-row .value.date {
  color: #6366f1;
}

.settlement-detail-row .value.success {
  color: #059669;
}

.settlement-detail-row .value.warning {
  color: #d97706;
}

.settlement-detail-row .notice {
  color: #6b7280;
  font-style: italic;
  font-size: 0.9rem;
}

/* 급여 기간 정보 카드 */
.cycle-info-card {
  background: #fefce8;
  border: 1px solid #eab308;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
}

.cycle-info-card h4 {
  margin: 0 0 8px 0;
  color: #a16207;
  font-size: 1rem;
  font-weight: 600;
}

.cycle-label {
  font-weight: 600;
  color: #92400e;
  font-size: 1.1rem;
}

.cycle-dates {
  margin-top: 4px;
  color: #6b7280;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.summary-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 3px solid #e5e7eb;
}

.summary-card.total {
  background: #ecfdf5;
  border-left-color: #10b981;
}

.summary-label {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
}

.summary-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f2937;
}

.summary-value.overtime {
  color: #dc2626;
}

.summary-card.total .summary-value {
  color: #059669;
  font-size: 1.25rem;
}

/* 직원 추가 정보 카드 */
.employee-extra-info {
  margin-top: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-card {
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 3px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 0.9rem;
  color: #1f2937;
  font-weight: 600;
}

/* 출퇴근 기록 */
.attendance-logs h4 {
  margin: 0 0 16px 0;
  color: #1f2937;
  font-size: 1.1rem;
  font-weight: 600;
}

.no-logs {
  text-align: center;
  padding: 40px 20px;
}

.no-logs .empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-logs p {
  margin: 0 0 16px 0;
  color: #6b7280;
}

.summary-info {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-row .label {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.summary-row .value {
  font-size: 0.9rem;
  color: #1f2937;
  font-weight: 600;
}

.summary-row .value.overtime {
  color: #dc2626;
}

.logs-table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
}

.logs-table th {
  background: #f8fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.9rem;
}

.logs-table td {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9rem;
}

.overtime-cell {
  color: #dc2626;
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.normal {
  background: #dcfce7;
  color: #166534;
}

.status-badge.overtime {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.incomplete {
  background: #fecaca;
  color: #991b1b;
}

.status-badge.absent {
  background: #f3f4f6;
  color: #6b7280;
}

.settlement-reference {
  margin-top: 4px;
}

.settlement-reference small {
  color: #6b7280;
  font-size: 0.7rem;
}

/* =========================
   알림 토스트
   ========================= */
.notification-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1100;
  min-width: 300px;
  max-width: 400px;
  border-left: 4px solid;
  animation: slideInRight 0.3s ease;
}

.notification-toast.success {
  border-left-color: #10b981;
}

.notification-toast.error {
  border-left-color: #ef4444;
}

.notification-toast.info {
  border-left-color: #3b82f6;
}

.notification-toast.warning {
  border-left-color: #f59e0b;
}

.notification-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.notification-message {
  flex: 1;
  color: #1f2937;
  font-size: 0.9rem;
  font-weight: 500;
}

.notification-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #9ca3af;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.notification-close:hover {
  background: #f3f4f6;
  color: #6b7280;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* =========================
   반응형 디자인
   ========================= */
@media (max-width: 1024px) {
  .payroll-management {
    padding: 16px;
  }
  
  .dashboard-stats {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .settlement-content {
    flex-direction: column;
    align-items: stretch;
    gap: 24px;
  }
  
  .settlement-summary {
    justify-content: space-between;
  }
  
  .table-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .search-input {
    min-width: auto;
  }
}

@media (max-width: 768px) {
  .stat-card {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .settlement-section .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .settlement-info {
    justify-content: center;
  }
  
  .settlement-summary {
    flex-direction: column;
    gap: 16px;
  }
  
  .payroll-table th,
  .payroll-table td {
    padding: 8px 6px;
    font-size: 0.8rem;
  }
  
  .employee-info {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  
  .employee-avatar {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-container {
    width: 95%;
    margin: 20px;
  }
  
  .notification-toast {
    left: 12px;
    right: 12px;
    min-width: auto;
  }
}
</style>