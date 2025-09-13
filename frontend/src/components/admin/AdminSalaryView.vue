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

<style scoped src="@/assets/styles/admin/AdminSalaryView.css"></style>
