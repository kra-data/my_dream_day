<template>
  <div class="payroll-management">
    <!-- 헤더 섹션 -->
    <div class="payroll-header">
      <div class="header-content">
        <div class="header-title-section">
          <h2><AppIcon name="money" :size="20" class="mr-2" />급여 관리</h2>
          <div class="header-summary">
            <div class="summary-item">
              <div class="summary-title-section">
                <span class="summary-label">예상 지출</span>
                <span class="summary-period">{{ payrollOverview?.cycle?.label || currentSettlementPeriod }}</span>
              </div>
              <div class="summary-values">
                <span class="summary-value primary">{{ formatCurrency(payrollStore.employeePayrollList?.summary?.totalAmount || 0) }}</span>
                <span class="summary-change" :class="getChangeClass(monthlyChange)">
                  {{ formatChange(monthlyChange) }}
                </span>
              </div>
            </div>
            <div class="summary-item">
              <span class="summary-label">급여 대상 직원</span>
              <span class="summary-value">{{ payrollStore.employeePayrollList?.summary?.employeeCount || 0 }}명</span>
            </div>
          </div>
        </div>
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
            <AppIcon name="stats" :size="16" class="mr-1" />
            엑셀 다운로드
          </button>
          
          <button 
            @click="refreshData"
            :disabled="payrollStore.loading || isLoadingData"
            class="btn btn-outline"
            title="데이터 새로고침"
          >
            <AppIcon name="refresh" :size="16" class="mr-1" :class="{ 'rotate': payrollStore.loading || isLoadingData }" />
            새로고침
          </button>
        </div>
      </div>
      
      <!-- 로딩 인디케이터 -->
      <div v-if="payrollStore.loading || isLoadingData" class="loading-bar">
        <div class="loading-progress"></div>
      </div>
    </div>


    <!-- 정산 관리 섹션 -->
    <div class="settlement-section">
      <div class="section-header">
        <h3><AppIcon name="briefcase" :size="20" class="mr-2" />정산 관리</h3>
        <div class="settlement-info">
          <span class="settlement-period">{{ payrollOverview?.cycle?.label || currentSettlementPeriod }}</span>
          <span class="settlement-status" :class="settlementStatusClass">
            {{ settlementStatusText }}
          </span>
        </div>
      </div>

      <div class="settlement-content">
        <div class="settlement-summary">
          <div class="summary-item">
            <span class="label">정산 대상 금액</span>
            <div class="amount-display">
              <span class="value amount">{{ formatCurrency(payrollOverview?.totals?.expectedPayout || totalSettlementAmount) }}</span>
              <div v-if="showTaxDeduction && (payrollOverview?.totals?.expectedPayout || totalSettlementAmount) > 0" class="tax-deduction">
                <small class="tax-label">세금공제 후: </small>
                <small class="tax-amount">{{ formatCurrency(payrollOverview?.totals?.expectedPayoutNet || getAfterTaxAmount(totalSettlementAmount)) }}</small>
              </div>
            </div>
          </div>
          <div class="summary-item">
            <span class="label">정산 대상 직원</span>
            <span class="value count pending">{{ payrollOverview?.meta?.eligibleEmployees || unsettledEmployeeCount }}명</span>
          </div>
          <div class="summary-item">
            <span class="label">시급 직원 급여</span>
            <span class="value">{{ formatCurrency(payrollOverview?.hourly?.amount || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">월급 직원 급여</span>
            <span class="value">{{ formatCurrency(payrollOverview?.fixed?.amount || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">근무 횟수</span>
            <span class="value time">{{ payrollOverview?.hourly?.shiftCount || 0 }}회</span>
          </div>
          <div class="summary-item">
            <span class="label">지난달 대비</span>
            <div class="amount-display">
              <span class="value comparison">{{ formatCurrency(0) }}</span>
              <div v-if="payrollOverview?.totals?.deltaFromPrev" class="change-indicator">
                <small :class="getChangeClass(payrollOverview.totals.deltaFromPrev)">
                  {{ payrollOverview.totals.deltaFromPrev > 0 ? '+' : '' }}{{ formatCurrency(Math.abs(payrollOverview.totals.deltaFromPrev)) }}
                </small>
              </div>
            </div>
          </div>
        </div>

        <div class="settlement-actions">
          <div class="settlement-controls">
            <div class="control-group">
              <label for="cycleStartDay" class="control-label">정산 기준일</label>
              <select 
                id="cycleStartDay"
                v-model="cycleStartDay" 
                @change="onCycleStartDayChange"
                class="cycle-select"
              >
                <option v-for="day in 31" :key="day" :value="day">
                  매월 {{ day }}일
                </option>
              </select>
            </div>
            <div class="tax-option">
              <label class="tax-checkbox">
                <input 
                  type="checkbox" 
                  v-model="showTaxDeduction"
                >
                <span class="checkmark"></span>
                세금 공제 (3.3%) 포함 보기
              </label>
            </div>
          </div>
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
              <AppIcon name="money" :size="16" class="mr-1" />
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
            <AppIcon name="search" :size="16" class="search-icon" />
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

        <div v-else-if="filteredEmployees.length === 0" class="empty-state">
          <div class="empty-icon"><AppIcon name="stats" :size="64" /></div>
          <h4>급여 데이터가 없습니다</h4>
          <p>{{ selectedYear }}년 {{ selectedMonth }}월의 급여 데이터가 없습니다.</p>
        </div>

        <table v-else class="payroll-table">
          <thead>
            <tr>
              <th class="sortable" @click="sortBy('name')">
                직원명
                <AppIcon name="sort" :size="14" class="sort-icon" :class="getSortIcon('name')" />
              </th>
              <th>직위</th>
              <th>급여 형태</th>
              <th class="sortable" @click="sortBy('salary')" style="text-align: right;">
                급여액
                <AppIcon name="sort" :size="14" class="sort-icon" :class="getSortIcon('salary')" />
              </th>
              <th style="text-align: right;">근무시간</th>
              <th style="text-align: center;">정산상태</th>
              <th class="actions">관리</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="employee in paginatedEmployees" 
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
                  <div 
                    class="employee-avatar"
                    :style="{ backgroundColor: employee.personalColor || getDefaultPersonalColor(employee.position) }"
                  >
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
                <span class="pay-type-badge" :class="employee.payUnit === 'HOURLY' ? 'hourly' : 'monthly'">
                  {{ employee.payUnit === 'HOURLY' ? '시급' : '월급' }}
                </span>
                <div class="pay-rate">
                  {{ formatCurrency(employee.pay) }}
                </div>
              </td>
              
              <td class="amount-cell">
                <div class="salary-display">
                  <span class="salary-amount">{{ formatCurrency(employee.amount) }}</span>
                  <div v-if="showTaxDeduction && employee.amount > 0" class="tax-deduction-small">
                    <small>세후: {{ formatCurrency(getAfterTaxAmount(employee.amount)) }}</small>
                  </div>
                </div>
              </td>
              
              <td class="time-cell">
                <span class="work-time">{{ formatMinutes(employee.workedMinutes) }}</span>
                <div class="work-days">{{ employee.daysWorked }}일</div>
              </td>
              
              <td class="settlement-status-cell" style="text-align: center;">
                <div class="settlement-status-badge" :class="getSettlementStatusClass(employee)">
                  <span class="status-icon"><AppIcon :name="getSettlementStatusIcon(employee)" :size="16" /></span>
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
                    :disabled="payrollStore.loading || employee.amount === 0 || employee.settlement?.status === 'PAID'"
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

        <!-- 더보기 버튼 -->
        <div v-if="hasMoreItems" class="load-more-container">
          <button 
            @click="loadMoreItems"
            :disabled="payrollStore.loading"
            class="btn btn-outline load-more-btn"
          >
            <span v-if="payrollStore.loading">로딩 중...</span>
            <span v-else>더보기 ({{ remainingItemsCount }}개 남음)</span>
          </button>
        </div>
        
        <!-- 전체 항목 표시 정보 -->
        <div class="items-info">
          <span class="showing-count">{{ displayedItemsCount }}개 표시 중</span>
          <span class="total-count"> / 총 {{ filteredEmployees.length }}개</span>
        </div>
      </div>
    </div>

    <!-- 직원 상세 모달 -->
    <div v-if="showDetailModal" class="modal-overlay" @click="closeDetailModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedEmployee?.name || '직원' }}님 급여 상세</h3>
          <button @click="closeDetailModal" class="modal-close">&times;</button>
        </div>

        <div v-if="payrollStore.loading" class="modal-loading">
          <div class="loading-spinner large"></div>
          <p>상세 정보를 불러오는 중...</p>
        </div>

        <div v-else-if="payrollStore.error" class="modal-error">
          <div class="error-icon"><AppIcon name="warning" :size="64" /></div>
          <h4>오류가 발생했습니다</h4>
          <p>{{ payrollStore.error }}</p>
          <button @click="closeDetailModal" class="btn btn-primary">확인</button>
        </div>
        
        <div v-else-if="selectedEmployee" class="modal-content">
          <!-- 요약 정보 -->
          <div class="detail-summary">
            <div class="summary-grid">
              <div class="summary-card">
                <span class="summary-label">근무 일수</span>
                <span class="summary-value">{{ selectedEmployee.daysWorked }}일</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">총 근무시간</span>
                <span class="summary-value">{{ formatMinutes(selectedEmployee.workedMinutes) }}</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">연장 근무시간</span>
                <span class="summary-value overtime">{{ formatMinutes(selectedEmployee.extraMinutes) }}</span>
              </div>
              <div class="summary-card total">
                <span class="summary-label">예상 급여</span>
                <span class="summary-value">{{ formatCurrency(selectedEmployee.amount) }}</span>
              </div>
            </div>
            
            <!-- 추가 정보 카드 -->
            <div class="employee-extra-info">
              <div class="info-grid">
                <div class="info-card">
                  <span class="info-label">급여 형태</span>
                  <span class="info-value">
                    {{ selectedEmployee.hourlyPay ? '시급제' : '월급제' }}
                  </span>
                </div>
                <div class="info-card">
                  <span class="info-label">기본급</span>
                  <span class="info-value">
                    {{ selectedEmployee.hourlyPay 
                        ? formatCurrency(selectedEmployee.hourlyPay) + '/시간'
                        : formatCurrency(selectedEmployee.monthlyPay) + '/월'
                    }}
                  </span>
                </div>
                <div class="info-card">
                  <span class="info-label">직위</span>
                  <span class="info-value">{{ formatPosition(selectedEmployee.position) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 알림 토스트 -->
    <div v-if="notification.show" class="notification-toast" :class="notification.type">
      <span class="notification-icon">
        <AppIcon :name="notification.type === 'success' ? 'success' : notification.type === 'error' ? 'error' : 'info'" :size="20" />
      </span>
      <span class="notification-message">{{ notification.message }}</span>
      <button @click="hideNotification" class="notification-close">&times;</button>
    </div>
    
    <!-- 정산 확인 모달 -->
    <EmployeeSettlementModal
      v-if="showSettlementModal"
      :settlementData="settlementModalData"
      :loading="payrollStore.loading"
      @confirm="confirmSettlement"
      @cancel="cancelSettlement"
    />
    
    <!-- 정산 결과 모달 -->
    <div v-if="showSettlementResultModal" class="modal-backdrop" @click="closeSettlementResult">
      <div class="modal settlement-result-modal" @click.stop>
        <div class="modal-header">
          <h3>
            <AppIcon name="check" :size="18" class="inline-block mr-2 text-green-500" />
            정산 완료
          </h3>
          <button @click="closeSettlementResult" class="close-btn">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        
        <div class="modal-body">
          <div v-if="settlementResult" class="settlement-completed">
            <div class="success-message">
              <div class="success-icon">✅</div>
              <h4>정산이 성공적으로 완료되었습니다!</h4>
            </div>
            
            <div class="settlement-details">
              <div class="detail-row">
                <span class="label">정산 ID</span>
                <span class="value">#{{ settlementResult.id }}</span>
              </div>
              <div class="detail-row">
                <span class="label">정산 기간</span>
                <span class="value">{{ formatDateRange(settlementResult.cycleStart, settlementResult.cycleEnd) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">총 근무시간</span>
                <span class="value">{{ formatMinutes(settlementResult.workedMinutes) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">기본급</span>
                <span class="value">{{ formatCurrency(settlementResult.basePay) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">총 급여</span>
                <span class="value">{{ formatCurrency(settlementResult.totalPay) }}</span>
              </div>
              <div class="detail-row tax">
                <span class="label">소득세</span>
                <span class="value">-{{ formatCurrency(settlementResult.incomeTax) }}</span>
              </div>
              <div class="detail-row tax">
                <span class="label">지방소득세</span>
                <span class="value">-{{ formatCurrency(settlementResult.localIncomeTax) }}</span>
              </div>
              <div v-if="settlementResult.otherTax > 0" class="detail-row tax">
                <span class="label">기타 세금</span>
                <span class="value">-{{ formatCurrency(settlementResult.otherTax) }}</span>
              </div>
              <div class="detail-row total">
                <span class="label">실 지급액</span>
                <span class="value">{{ formatCurrency(settlementResult.netPay) }}</span>
              </div>
              <div v-if="settlementResult.note" class="detail-row">
                <span class="label">메모</span>
                <span class="value">{{ settlementResult.note }}</span>
              </div>
            </div>
            
            <div class="settlement-timestamp">
              정산 완료: {{ formatDateTime(settlementResult.settledAt) }}
            </div>
          </div>
          
          <div class="modal-actions">
            <button @click="closeSettlementResult" class="btn btn-primary">
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { usePayrollStore } from '@/stores/payroll'
import AppIcon from '@/components/AppIcon.vue'
import EmployeeSettlementModal from '@/components/admin/EmployeeSettlementModal.vue'

export default {
  name: 'AdminSalaryView',
  components: {
    AppIcon,
    EmployeeSettlementModal
  },
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
    const displayedItemsCount = ref(10) // 현재 표시되고 있는 항목 수
    const itemsPerPage = ref(10) // 한 번에 로드할 항목 수
    const settlingEmployeeId = ref(null)
    const showTaxDeduction = ref(false)
    
    // 새로운 급여 개요 데이터
    const payrollOverview = ref(null)
    const cycleStartDay = ref(1) // 기본값 1일 (매월 1일)
    
    // 모달 상태 관리
    const showSettlementModal = ref(false)
    const settlementModalData = ref(null)
    const settlementResult = ref(null)
    const showSettlementResultModal = ref(false)
    
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
      // TODO: API에서 월별 변화량 데이터 제공 후 구현
      return 0
    })
    
    const currentSettlementPeriod = computed(() => {
      return `${selectedYear.value}년 ${selectedMonth.value}월 정산기간`
    })
    
    const totalSettlementAmount = computed(() => {
      // 미정산 직원들의 급여 합계
      const items = payrollStore.employeePayrollList?.items || []
      return items
        .filter(emp => !emp.settlement || emp.settlement.status === 'PENDING')
        .reduce((sum, emp) => sum + emp.amount, 0)
    })
    
    const unsettledEmployeeCount = computed(() => {
      const items = payrollStore.employeePayrollList?.items || []
      return items.filter(emp => 
        !emp.settlement || emp.settlement.status === 'PENDING'
      ).length
    })
    
    const settledEmployeeCount = computed(() => {
      const items = payrollStore.employeePayrollList?.items || []
      return items.filter(emp => 
        emp.settlement && emp.settlement.status === 'PAID'
      ).length
    })
    
    const settlementStatusClass = computed(() => {
      const summary = payrollStore.employeePayrollList?.summary
      if (!summary) return 'pending'
      const pendingCount = summary.pendingCount || 0
      if (pendingCount === 0) return 'completed'
      return 'pending'
    })
    
    const settlementStatusText = computed(() => {
      const summary = payrollStore.employeePayrollList?.summary
      if (!summary) return '데이터 로드 중'
      const pendingCount = summary.pendingCount || 0
      if (pendingCount === 0) return '정산 완료'
      return `${pendingCount}명 정산 대기`
    })

    // 필터링된 직원 목록
    const filteredEmployees = computed(() => {
      const items = payrollStore.employeePayrollList?.items || []
      let filtered = [...items]
      
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
    
    // 더보기 관련 computed 속성들
    const hasMoreItems = computed(() => {
      return displayedItemsCount.value < filteredEmployees.value.length
    })
    
    const remainingItemsCount = computed(() => {
      return Math.max(0, filteredEmployees.value.length - displayedItemsCount.value)
    })
    
    const paginatedEmployees = computed(() => {
      return filteredEmployees.value.slice(0, displayedItemsCount.value)
    })
    
    
    // API 함수들은 payrollStore에서 직접 호출
    
    const onDateChange = async () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
      }
      
      fetchTimeout = setTimeout(async () => {
        try {
          await payrollStore.fetchEmployeePayrollList(selectedYear.value, selectedMonth.value)
          showNotification('success', `${selectedYear.value}년 ${selectedMonth.value}월 데이터를 불러왔습니다.`)
        } catch {
          showNotification('error', '데이터 로드에 실패했습니다.')
        }
      }, 300)
    }
    
    const refreshData = async () => {
      try {
        await payrollStore.fetchEmployeePayrollList(selectedYear.value, selectedMonth.value)
        showNotification('success', '데이터를 새로고침했습니다.')
      } catch {
        showNotification('error', '데이터 새로고침에 실패했습니다.')
      }
    }
    
    // TODO: API 구현 후 정산 사이클 변경 기능 추가
    const onCycleStartDayChange = () => {
      showNotification('info', '정산 사이클 변경 기능은 아직 구현 예정인 기능입니다.')
    }
    
    const exportExcel = async () => {
      try {
        showNotification('info', '엑셀 파일을 생성중입니다...')
        // 기본값 1일이 아닌 경우에만 cycleStartDay 전송
        await payrollStore.exportPayrollExcel(
          selectedYear.value, 
          selectedMonth.value, 
          cycleStartDay.value === 1 ? null : cycleStartDay.value
        )
        showNotification('success', '엑셀 파일이 다운로드되었습니다.')
      } catch (error) {
        console.error('엑셀 다운로드 실패:', error)
        showNotification('error', '엑셀 다운로드에 실패했습니다.')
      }
    }
    
    const viewEmployeeDetail = (employeeId) => {
      const items = payrollStore.employeePayrollList?.items || []
      selectedEmployee.value = items.find(emp => emp.employeeId === employeeId)
      showDetailModal.value = true
    }
    
    const closeDetailModal = () => {
      showDetailModal.value = false
      selectedEmployee.value = null
    }
    
    // TODO: API 구현 후 정산 처리 기능 추가
    const processSettlement = () => {
      showNotification('info', '아직 구현 예정인 기능입니다.')
    }
    
    const processIndividualSettlement = async (employee) => {
      if (!employee || employee.amount === 0) {
        showNotification('warning', '정산할 급여가 없습니다.')
        return
      }
      
      // 정산 모달 데이터 설정
      settlementModalData.value = {
        employee: employee,
        amount: employee.amount,
        workedMinutes: employee.workedMinutes || 0,
        // API에서 받은 세금 정보가 있다면 사용, 없다면 기본 계산
        incomeTax: employee.incomeTax || Math.floor(employee.amount * 0.03),
        localIncomeTax: employee.localIncomeTax || Math.floor(employee.amount * 0.003),
        otherTax: employee.otherTax || 0
      }
      
      // 실 지급액 계산
      const totalTax = settlementModalData.value.incomeTax + settlementModalData.value.localIncomeTax + settlementModalData.value.otherTax
      settlementModalData.value.netAmount = Math.max(0, employee.amount - totalTax)
      
      showSettlementModal.value = true
    }
    
    const confirmSettlement = async () => {
      const employee = settlementModalData.value?.employee
      if (!employee) return
      
      settlingEmployeeId.value = employee.employeeId
      
      try {
        const result = await payrollStore.processEmployeeSettlement(employee.employeeId, selectedYear.value, selectedMonth.value)
        
        // 모달 닫기
        showSettlementModal.value = false
        
        // 정산 완료 후 데이터 새로고침
        await payrollStore.fetchEmployeePayrollList(selectedYear.value, selectedMonth.value)
        
        // 정산 결과 표시
        settlementResult.value = result.settlement
        showSettlementResultModal.value = true
        
        console.log('정산 결과:', result)
      } catch (error) {
        console.error(`${employee.name} 정산 처리 실패:`, error)
        showNotification('error', `${employee.name}님 정산 처리에 실패했습니다: ${error.message || '알 수 없는 오류'}`)
      } finally {
        settlingEmployeeId.value = null
      }
    }
    
    const cancelSettlement = () => {
      showSettlementModal.value = false
      settlementModalData.value = null
    }
    
    const closeSettlementResult = () => {
      showSettlementResultModal.value = false
      settlementResult.value = null
    }
    
    const sortBy = (field) => {
      if (sortField.value === field) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      } else {
        sortField.value = field
        sortDirection.value = 'asc'
      }
      // 정렬 변경 시 표시 항목 수 초기화
      displayedItemsCount.value = itemsPerPage.value
    }
    
    const loadMoreItems = () => {
      const newCount = displayedItemsCount.value + itemsPerPage.value
      displayedItemsCount.value = Math.min(newCount, filteredEmployees.value.length)
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
    
    // 세금 공제 계산 (3.3%)
    const getAfterTaxAmount = (amount) => {
      if (!amount || amount <= 0) return 0
      return Math.round(amount * (1 - 0.033))
    }
    
    // 유틸리티 함수들
    const formatCurrency = (amount) => {
      if (!amount) return '0원'
      return `${amount.toLocaleString()}원`
    }
    
    const formatDateRange = (startDate, endDate) => {
      if (!startDate || !endDate) return '-'
      const start = new Date(startDate)
      const end = new Date(endDate)
      return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`
    }
    
    const formatDateTime = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
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
    
    // 직원 관련 유틸리티 함수들
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
    
    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString('ko-KR')
    }
    
    const calculateWorkDays = (workedMinutes) => {
      if (!workedMinutes) return 0
      return Math.round(workedMinutes / 480)
    }
    
    const getSettlementStatusClass = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return 'settled'
      }
      return 'pending'
    }
    
    const getSettlementStatusIcon = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return 'success'
      }
      return 'clock'
    }
    
    const getSettlementStatusText = (employee) => {
      if (employee.settlement?.status === 'PAID') {
        return '정산 완료'
      }
      return '정산 전'
    }
    
    const getDefaultPersonalColor = (position) => {
      const positionColors = {
        'OWNER': '#dc2626',
        'MANAGER': '#2563eb',
        'STAFF': '#059669',
        'PART_TIME': '#7c3aed'
      }
      return positionColors[position] || '#6b7280'
    }
    
    // 검색어 변경시 표시 항목 수 리셋
    watch([searchQuery, positionFilter, settlementFilter], () => {
      displayedItemsCount.value = itemsPerPage.value
    })
    
    
    // 컴포넌트 마운트
    onMounted(async () => {
      // 컴포넌트 초기화 - 데이터 로드
      try {
        await payrollStore.fetchEmployeePayrollList(selectedYear.value, selectedMonth.value)
      } catch (error) {
        console.error('초기 데이터 로드 실패:', error)
      }
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
      showSettlementModal,
      settlementModalData,
      settlementResult,
      showSettlementResultModal,
      searchQuery,
      positionFilter,
      settlementFilter,
      sortField,
      sortDirection,
      displayedItemsCount,
      itemsPerPage,
      settlingEmployeeId,
      showTaxDeduction,
      notification,
      payrollOverview,
      cycleStartDay,
      
      // Computed
      availableYears,
      monthlyChange,
      currentSettlementPeriod,
      totalSettlementAmount,
      unsettledEmployeeCount,
      settledEmployeeCount,
      settlementStatusClass,
      settlementStatusText,
      filteredEmployees,
      hasMoreItems,
      remainingItemsCount,
      paginatedEmployees,
      
      // Methods
      onDateChange,
      onCycleStartDayChange,
      refreshData,
      exportExcel,
      viewEmployeeDetail,
      closeDetailModal,
      processSettlement,
      processIndividualSettlement,
      confirmSettlement,
      cancelSettlement,
      closeSettlementResult,
      sortBy,
      loadMoreItems,
      showNotification,
      hideNotification,
      
      // Utils
      formatCurrency,
      formatMinutes,
      formatDateRange,
      formatDateTime,
      formatWorkHours,
      formatChange,
      getChangeClass,
      getAfterTaxAmount,
      formatPayRate,
      calculateOvertimePay,
      getInitial,
      formatPosition,
      getPositionClass,
      getSortIcon,
      formatDate,
      calculateWorkDays,
      getSettlementStatusClass,
      getSettlementStatusIcon,
      getSettlementStatusText,
      getDefaultPersonalColor
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

.header-title-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 24px;
}

.payroll-header h2 {
  color: #1f2937;
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.header-summary {
  display: flex;
  gap: 32px;
  align-items: flex-end;
}

.header-summary .summary-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 200px;
}

.header-summary .summary-label {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.header-summary .summary-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
}

.header-summary .summary-value.primary {
  color: #059669;
  font-size: 1.25rem;
}

.header-summary .summary-title-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.header-summary .summary-period {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
  font-style: italic;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap;
}

.header-summary .summary-values {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.header-summary .summary-change {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.header-summary .summary-change.positive {
  background: #dcfce7;
  color: #16a34a;
}

.header-summary .summary-change.negative {
  background: #fef2f2;
  color: #dc2626;
}

.header-summary .summary-change.neutral {
  background: #f3f4f6;
  color: #6b7280;
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

.summary-item .value.time {
  color: #0891b2;
}

.summary-item .value.comparison {
  color: #9ca3af;
  font-size: 0.95rem;
}

.settlement-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tax-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tax-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #374151;
  font-weight: 500;
}

.tax-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
}

.amount-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.tax-deduction {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tax-label {
  color: #6b7280;
  font-weight: 500;
}

.tax-amount {
  color: #059669;
  font-weight: 600;
}

.salary-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.tax-deduction-small {
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 500;
}

.change-indicator {
  margin-top: 4px;
}

.change-indicator small {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.change-indicator .positive {
  background: #dcfce7;
  color: #16a34a;
}

.change-indicator .negative {
  background: #fef2f2;
  color: #dc2626;
}

.change-indicator .neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.settlement-controls {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.cycle-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
  color: #374151;
  min-width: 120px;
  cursor: pointer;
}

.cycle-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.info-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1e40af;
  font-size: 0.9rem;
  font-weight: 500;
}

/* =========================
   급여 상세 정보 섹션
   ========================= */
.payroll-detail-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}

.payroll-detail-section .section-header {
  margin-bottom: 24px;
}

.payroll-detail-section h3 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.payroll-detail-section p {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-state p {
  margin: 16px 0 0;
  color: #6b7280;
}

.detail-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.detail-card {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.detail-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.card-header h4 {
  margin: 0;
  color: #374151;
  font-size: 1.1rem;
  font-weight: 600;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-content .amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #059669;
}

.card-content .meta {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.card-content .tax-info {
  font-size: 0.85rem;
  color: #059669;
  font-weight: 600;
  padding: 4px 8px;
  background: #dcfce7;
  border-radius: 6px;
  display: inline-block;
  width: fit-content;
}

.card-content .change-info {
  font-size: 0.8rem;
  color: #9ca3af;
  font-weight: 500;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid white;
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

/* 더보기 버튼 */
.load-more-container {
  display: flex;
  justify-content: center;
  margin: 24px 0 16px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.load-more-btn {
  min-width: 200px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 항목 정보 */
.items-info {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
  margin-bottom: 16px;
  font-size: 14px;
  color: #6b7280;
}

.showing-count {
  font-weight: 500;
  color: #374151;
}

.total-count {
  opacity: 0.8;
  font-size: 0.8rem;
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
  
  .header-title-section {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-summary {
    justify-content: space-between;
    gap: 16px;
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
  .header-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-summary .summary-item {
    align-items: flex-start;
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

/* 정산 결과 모달 */
.settlement-result-modal {
  max-width: 600px;
  width: 90%;
}

.settlement-completed {
  text-align: center;
}

.success-message {
  margin-bottom: 24px;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.success-message h4 {
  margin: 0;
  color: #059669;
  font-size: 18px;
  font-weight: 600;
}

.settlement-details {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: left;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row.tax .value {
  color: #dc2626;
}

.detail-row.total {
  font-weight: 600;
  font-size: 16px;
  background: #059669;
  color: white;
  margin: 12px -20px -20px;
  padding: 12px 20px;
  border-radius: 0 0 6px 6px;
}

.detail-row .label {
  font-weight: 500;
  color: #374151;
}

.detail-row .value {
  font-weight: 600;
  color: #1f2937;
}

.settlement-timestamp {
  font-size: 14px;
  color: #6b7280;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

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
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
</style>