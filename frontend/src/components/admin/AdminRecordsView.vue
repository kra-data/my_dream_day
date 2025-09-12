<template>
  <div class="tab-content">
    <!-- Loading State -->
    <div v-if="attendanceStore.loading && !attendanceStore.records.length" class="loading-container">
      <div class="loading-spinner"></div>
      <p>출퇴근 기록을 불러오는 중...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="attendanceStore.error" class="error-container">
      <div class="error-message">
        <h3><AppIcon name="warning" :size="20" class="mr-2" />오류가 발생했습니다</h3>
        <p>{{ attendanceStore.error }}</p>
        <button @click="retryFetchRecords" class="btn btn-primary">다시 시도</button>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="records-section">
      <div class="section-header">
        <div class="header-info">
          <h2><AppIcon name="clipboard" :size="20" class="mr-2" />출퇴근 기록</h2>
          <p class="records-count">총 {{ attendanceStore.records.length }}건의 기록</p>
        </div>
        <div class="filters">
          <input 
            type="date" 
            v-model="selectedDate"
            @change="applyFilters"
            class="date-input"
          >
          <select v-model="selectedEmployee" @change="applyFilters" class="employee-filter">
            <option value="">전체 직원</option>
            <option 
              v-for="employee in employeesStore.employees" 
              :key="employee.id"
              :value="employee.id"
            >
              {{ employee.name }}
            </option>
          </select>
          <select v-model="selectedSection" @change="applyFilters" class="section-filter">
            <option value="">전체 구역</option>
            <option value="KITCHEN">주방</option>
            <option value="HALL">홀</option>
          </select>
          <select v-model="selectedStatus" @change="applyFilters" class="status-filter">
            <option value="">전체 상태</option>
            <option value="completed">완료</option>
            <option value="incomplete">미완료</option>
          </select>
          <button @click="exportRecords" class="btn btn-success">
            <AppIcon name="document" :size="16" class="mr-1" />엑셀 내보내기
          </button>
        </div>
      </div>

      <!-- Records Table -->
      <div class="records-table-container">
        <!-- Empty State -->
        <div v-if="attendanceStore.isEmpty" class="empty-state">
          <div class="empty-icon"><AppIcon name="clipboard" :size="64" /></div>
          <h3>출퇴근 기록이 없습니다</h3>
          <p>아직 등록된 출퇴근 기록이 없습니다.</p>
        </div>

        <!-- Records Table -->
        <div v-else class="records-table">
          <div class="table-header">
            <div class="table-row header-row">
              <div class="table-cell">날짜</div>
              <div class="table-cell">직원명</div>
              <div class="table-cell">직급</div>
              <div class="table-cell">구역</div>
              <div class="table-cell">출근시간</div>
              <div class="table-cell">퇴근시간</div>
              <div class="table-cell">근무시간</div>
              <div class="table-cell">급여</div>
              <div class="table-cell">상태</div>
              <div class="table-cell">메모</div>
              <div class="table-cell">관리</div>
            </div>
          </div>
          
          <div class="table-body">
            <div v-if="filteredRecords.length === 0" class="no-filtered-data">
              <p>선택한 조건에 해당하는 기록이 없습니다.</p>
            </div>
            <div 
              v-else 
              v-for="record in filteredRecords" 
              :key="record.id"
              class="table-row data-row"
            >
              <div class="table-cell date-cell">
                <div class="date-display">
                  <span class="date-main">{{ formatDate(record.clockInAt || record.date) }}</span>
                  <span class="date-sub">{{ formatWeekday(record.clockInAt || record.date) }}</span>
                </div>
              </div>
              <div class="table-cell employee-cell">
                <div class="employee-info">
                  <span class="employee-name">{{ record.employeeName }}</span>
                  <span class="employee-id">#{{ record.employeeId }}</span>
                </div>
              </div>
              <div class="table-cell position-cell">
                <span class="position-badge" :class="getPositionClass(record.employeePosition)">
                  {{ formatPosition(record.employeePosition) }}
                </span>
              </div>
              <div class="table-cell section-cell">
                <span class="section-badge" :class="getSectionClass(record.employeeSection)">
                  {{ formatSection(record.employeeSection) }}
                </span>
              </div>
              <div class="table-cell time-cell">
                <span v-if="record.clockInAt" class="time-in">
                  {{ formatTime(record.clockInAt) }}
                </span>
                <span v-else class="time-empty">-</span>
              </div>
              <div class="table-cell time-cell">
                <span v-if="record.clockOutAt" class="time-out">
                  {{ formatTime(record.clockOutAt) }}
                </span>
                <span v-else class="time-empty">-</span>
              </div>
              <div class="table-cell duration-cell">
                <div class="duration-info">
                  <span class="work-duration">
                    {{ formatWorkDuration(record.actualMinutes || record.workedMinutes) }}
                  </span>
                  <span v-if="record.extraMinutes > 0" class="extra-time">
                    +{{ formatWorkDuration(record.extraMinutes) }}
                  </span>
                  <span v-if="record.actualMinutes && record.actualMinutes !== record.workedMinutes" class="actual-time">
                    (실제: {{ formatWorkDuration(record.actualMinutes) }})
                  </span>
                </div>
              </div>
              <div class="table-cell pay-cell">
                <span v-if="record.finalPayAmount > 0" class="pay-amount">
                  {{ formatCurrency(record.finalPayAmount) }}
                </span>
                <span v-else-if="record.payRate" class="pay-rate">
                  {{ formatCurrency(record.payRate) }}/시
                </span>
                <span v-else class="pay-empty">-</span>
              </div>
              <div class="table-cell status-cell">
                <StatusBadge :status="getRecordStatus(record)" />
              </div>
              <div class="table-cell memo-cell">
                <span 
                  v-if="record.memo" 
                  class="memo-text clickable" 
                  :title="record.memo"
                  @click="openMemoModal(record)"
                >
                  {{ record.memo.length > 10 ? record.memo.substring(0, 10) + '...' : record.memo }}
                </span>
                <span v-else class="memo-empty">-</span>
              </div>
              <div class="table-cell action-cell">
                <button 
                  @click="editRecord(record)"
                  class="btn btn-secondary btn-sm"
                  title="기록 수정"
                >
                  수정
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="attendanceStore.hasMore" class="load-more-container">
          <button 
            @click="loadMore" 
            :disabled="attendanceStore.loading"
            class="btn btn-outline load-more-btn"
          >
            <span v-if="attendanceStore.loading">로딩 중...</span>
            <span v-else>더 보기 ({{ attendanceStore.hasMore ? '더 있음' : '끝' }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 메모 내용 모달 -->
    <div v-if="showMemoModal" class="modal-overlay" @click="closeMemoModal">
      <div class="modal-content memo-modal-content" @click.stop>
        <div class="modal-header">
          <h3><AppIcon name="message-square" :size="20" class="mr-2" />메모 내용</h3>
          <button @click="closeMemoModal" class="modal-close">&times;</button>
        </div>
        <div class="memo-modal-body" v-if="selectedMemoRecord">
          <div class="employee-info-section">
            <div class="employee-name-memo">{{ selectedMemoRecord.employeeName }}</div>
            <div class="memo-date">{{ formatDate(selectedMemoRecord.clockInAt || selectedMemoRecord.date) }} ({{ formatWeekday(selectedMemoRecord.clockInAt || selectedMemoRecord.date) }})</div>
          </div>
          <div class="memo-content-section">
            <div class="memo-full-content">
              {{ selectedMemoRecord.memo }}
            </div>
          </div>
        </div>
        <div class="memo-modal-actions">
          <button @click="closeMemoModal" class="btn btn-primary">
            닫기
          </button>
        </div>
      </div>
    </div>

    <!-- 출퇴근 기록 수정 모달 -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content edit-modal-content" @click.stop>
        <div class="modal-header">
          <h3><AppIcon name="edit" :size="20" class="mr-2" />출퇴근 기록 수정</h3>
          <button @click="closeEditModal" class="modal-close">&times;</button>
        </div>
        <div class="edit-form" v-if="editingRecord">
          <div class="employee-info-header">
            <div class="employee-name">{{ editingRecord.employeeName }}</div>
            <div class="employee-details">
              {{ formatPosition(editingRecord.employeePosition) }} • {{ formatSection(editingRecord.employeeSection) }}
            </div>
            <div class="record-date">{{ formatDate(editingRecord.clockInAt || editingRecord.date) }}</div>
          </div>

          <div class="form-section">
            <div class="form-group">
              <label>출근 시간</label>
              <input 
                type="datetime-local" 
                v-model="editForm.clockInAt"
                class="form-input"
              >
            </div>
            
            <div class="form-group">
              <label>퇴근 시간</label>
              <input 
                type="datetime-local" 
                v-model="editForm.clockOutAt"
                class="form-input"
              >
            </div>
          </div>

          <div class="calculated-info" v-if="editForm.clockInAt && editForm.clockOutAt">
            <div class="info-item">
              <span class="info-label">근무 시간:</span>
              <span class="info-value">{{ calculateDisplayTime(editForm.clockInAt, editForm.clockOutAt) }}</span>
            </div>
          </div>

          <div class="form-actions">
            <button @click="closeEditModal" class="btn btn-secondary" :disabled="attendanceStore.loading">
              취소
            </button>
            <button @click="saveEditedRecord" class="btn btn-primary" :disabled="attendanceStore.loading">
              <span v-if="attendanceStore.loading"><AppIcon name="save" :size="16" class="mr-1" />저장 중...</span>
              <span v-else><AppIcon name="edit" :size="16" class="mr-1" />수정 완료</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminRecordsView',
  components: {
    StatusBadge,
    AppIcon
  },
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    
    // 필터 상태
    const selectedDate = ref('')
    const selectedEmployee = ref('')
    const selectedSection = ref('')
    const selectedStatus = ref('')
    
    // 수정 모달 상태
    const showEditModal = ref(false)
    const editingRecord = ref(null)
    const editForm = ref({
      clockInAt: '',
      clockOutAt: ''
    })
    
    // 메모 모달 상태
    const showMemoModal = ref(false)
    const selectedMemoRecord = ref(null)
    
    // 필터링된 기록
    const filteredRecords = computed(() => {
      let records = attendanceStore.records
      
      // 날짜 필터
      if (selectedDate.value) {
        const targetDate = new Date(selectedDate.value).toDateString()
        records = records.filter(record => 
          new Date(record.clockInAt || record.date).toDateString() === targetDate
        )
      }
      
      // 직원 필터
      if (selectedEmployee.value) {
        records = records.filter(record => 
          record.employeeId === parseInt(selectedEmployee.value)
        )
      }
      
      // 구역 필터
      if (selectedSection.value) {
        records = records.filter(record => 
          record.employeeSection === selectedSection.value
        )
      }
      
      // 상태 필터
      if (selectedStatus.value) {
        records = records.filter(record => {
          if (selectedStatus.value === 'completed') {
            return record.paired || (record.clockInAt && record.clockOutAt)
          } else if (selectedStatus.value === 'incomplete') {
            return !record.paired || !record.clockOutAt
          }
          return true
        })
      }
      
      return records.sort((a, b) => new Date(b.clockInAt || b.date) - new Date(a.clockInAt || a.date))
    })
    
    // 필터 적용 함수
    const applyFilters = () => {
      console.log('필터 적용:', {
        date: selectedDate.value,
        employee: selectedEmployee.value,
        section: selectedSection.value,
        status: selectedStatus.value
      })
    }
    
    // 데이터 재시도
    const retryFetchRecords = async () => {
      try {
        attendanceStore.resetRecords()
        await attendanceStore.fetchRecords()
      } catch (error) {
        console.error('기록 재시도 실패:', error)
      }
    }
    
    // 더 보기
    const loadMore = async () => {
      try {
        await attendanceStore.loadMoreRecords(selectedDate.value)
      } catch (error) {
        console.error('추가 데이터 로딩 실패:', error)
      }
    }
    
    onMounted(() => {
      console.log('AdminRecordsView: 마운트됨')
    })
    
    return {
      employeesStore,
      attendanceStore,
      selectedDate,
      selectedEmployee,
      selectedSection,
      selectedStatus,
      filteredRecords,
      applyFilters,
      retryFetchRecords,
      loadMore,
      showEditModal,
      editingRecord,
      editForm,
      showMemoModal,
      selectedMemoRecord
    }
  },
  methods: {
    formatSection(section) {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방',
        'UNKNOWN': '미지정'
      }
      return sections[section] || section
    },
    
    formatPosition(position) {
      const positions = {
        'MANAGER': '매니저',
        'STAFF': '직원',
        'PART_TIME': '알바'
      }
      return positions[position] || position
    },
    
    getPositionClass(position) {
      return `position-${position?.toLowerCase() || 'unknown'}`
    },
    
    getSectionClass(section) {
      return `section-${section?.toLowerCase() || 'unknown'}`
    },

    formatCurrency(amount) {
      if (!amount || amount <= 0) return '0원'
      return `${amount.toLocaleString()}원`
    },
    
    getRecordStatus(record) {
      // Use new status field or enhanced status logic
      if (record.status) {
        const statusMap = {
          'COMPLETED': 'completed',
          'IN_PROGRESS': 'working',
          'CANCELLED': 'cancelled',
          'PENDING': 'pending'
        }
        return statusMap[record.status] || 'unknown'
      }
      
      // Use enhanced computed status fields
      if (record.isCompleted) return 'completed'
      if (record.isInProgress) return 'working'
      
      // Legacy fallback with paired field
      if ('paired' in record) {
        return record.paired ? 'completed' : 'working'
      }
      // Fallback to old logic
      if (!record.clockInAt) return 'not-checked-in'
      if (record.clockOutAt) return 'completed'
      return 'working'
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    },
    
    formatWeekday(timestamp) {
      return new Date(timestamp).toLocaleDateString('ko-KR', {
        weekday: 'short'
      })
    },
    
    formatWorkDuration(workedMinutes) {
      if (workedMinutes === null || workedMinutes === undefined || workedMinutes === 0) return '-'
      
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      
      if (hours === 0) {
        return `${minutes}분`
      } else if (minutes === 0) {
        return `${hours}시간`
      } else {
        return `${hours}시간 ${minutes}분`
      }
    },
    
    exportRecords() {
      const headers = ['날짜', '요일', '직원명', '직원ID', '직급', '구역', '출근시간', '퇴근시간', '근무시간', '연장시간', '상태']
      const csvData = [headers]
      
      this.filteredRecords.forEach(record => {
        csvData.push([
          this.formatDate(record.clockInAt || record.date),
          this.formatWeekday(record.clockInAt || record.date),
          record.employeeName,
          record.employeeId,
          this.formatPosition(record.employeePosition),
          this.formatSection(record.employeeSection),
          record.clockInAt ? this.formatTime(record.clockInAt) : '-',
          record.clockOutAt ? this.formatTime(record.clockOutAt) : '-',
          this.formatWorkDuration(record.workedMinutes),
          this.formatWorkDuration(record.extraMinutes),
          record.paired ? '완료' : '미완료'
        ])
      })
      
      const csvContent = csvData.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(',')).join('\n')
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const today = new Date()
      const dateStr = this.selectedDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      link.download = `출퇴근기록_${dateStr}.csv`
      link.click()
    },

    // 메모 모달 관련 메서드
    openMemoModal(record) {
      this.selectedMemoRecord = record
      this.showMemoModal = true
    },

    closeMemoModal() {
      this.showMemoModal = false
      this.selectedMemoRecord = null
    },

    // 출퇴근 기록 수정 관련 메서드
    editRecord(record) {
      this.editingRecord = record
      this.editForm = {
        clockInAt: record.clockInAt ? this.formatDatetimeLocal(record.clockInAt) : '',
        clockOutAt: record.clockOutAt ? this.formatDatetimeLocal(record.clockOutAt) : ''
      }
      this.showEditModal = true
    },

    closeEditModal() {
      this.showEditModal = false
      this.editingRecord = null
      this.editForm = {
        clockInAt: '',
        clockOutAt: ''
      }
    },

    async saveEditedRecord() {
      try {
        const updateData = {}
        
        if (this.editForm.clockInAt) {
          updateData.clockInAt = new Date(this.editForm.clockInAt).toISOString()
        }
        
        if (this.editForm.clockOutAt) {
          updateData.clockOutAt = new Date(this.editForm.clockOutAt).toISOString()
        }

        await this.attendanceStore.editAttendanceRecord(this.editingRecord.id, updateData)
        
        alert('출퇴근 기록이 성공적으로 수정되었습니다')
        this.closeEditModal()
        
        // 기록 목록 새로고침
        await this.retryFetchRecords()
      } catch (error) {
        alert('출퇴근 기록 수정에 실패했습니다: ' + error.message)
      }
    },

    // datetime-local input에 맞는 형식으로 변환 (YYYY-MM-DDTHH:mm)
    formatDatetimeLocal(timestamp) {
      if (!timestamp) return ''
      
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
    },

    // 근무 시간 계산 표시
    calculateDisplayTime(clockInAt, clockOutAt) {
      if (!clockInAt || !clockOutAt) return '-'
      
      const start = new Date(clockInAt)
      const end = new Date(clockOutAt)
      const diffMs = end.getTime() - start.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      
      const hours = Math.floor(diffMinutes / 60)
      const minutes = diffMinutes % 60
      
      if (hours === 0) {
        return `${minutes}분`
      } else if (minutes === 0) {
        return `${hours}시간`
      } else {
        return `${hours}시간 ${minutes}분`
      }
    }
  }
}
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
  padding: var(--space-6);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Loading & Error States */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: var(--space-4);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-light);
  border-top: 3px solid var(--primary-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}


.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.error-message {
  text-align: center;
  padding: var(--space-8);
  background: var(--danger-50);
  border: 1px solid var(--danger-200);
  border-radius: var(--radius-lg);
  max-width: 400px;
}

.error-message h3 {
  color: var(--danger-700);
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-lg);
}

.error-message p {
  color: var(--danger-600);
  margin: 0 0 var(--space-4) 0;
}

/* Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

.header-info h2 {
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.records-count {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

.filters {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.date-input, 
.employee-filter, 
.section-filter, 
.status-filter {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-base);
  font-size: var(--text-sm);
  min-width: 120px;
  transition: var(--transition-base);
}

.date-input:focus, 
.employee-filter:focus, 
.section-filter:focus, 
.status-filter:focus {
  outline: none;
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-100);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-16) var(--space-8);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state h3 {
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-xl);
}

.empty-state p {
  margin: 0;
  font-size: var(--text-base);
}

/* Records Table */
.records-table-container {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  position: relative;
}

.records-table {
  width: 100%;
}

.table-header {
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-medium);
}

.table-row {
  display: grid;
  grid-template-columns: 120px 140px 80px 100px 100px 100px 120px 100px 80px 100px 80px;
  gap: var(--space-2);
  align-items: center;
}

.header-row .table-cell {
  padding: var(--space-4) var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-row {
  border-bottom: 1px solid var(--color-border-light);
  transition: var(--transition-base);
}

.data-row:hover {
  background: var(--color-bg-secondary);
}

.data-row:last-child {
  border-bottom: none;
}

.data-row .table-cell {
  padding: var(--space-4) var(--space-3);
  font-size: var(--text-sm);
}

/* Cell Specific Styles */
.date-cell {
  display: flex;
  flex-direction: column;
}

.date-main {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.date-sub {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.employee-cell {
  display: flex;
  flex-direction: column;
}

.employee-name {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.employee-id {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.duration-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.work-duration {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.extra-time {
  font-size: var(--text-xs);
  color: var(--warning-600);
  margin-top: var(--space-1);
}

.actual-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.memo-cell {
  max-width: 100px;
}

.memo-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
}

.memo-text.clickable {
  cursor: pointer;
  color: var(--primary-600);
  transition: var(--transition-base);
}

.memo-text.clickable:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

.memo-empty {
  color: var(--color-text-tertiary);
  font-style: italic;
}

.action-cell {
  text-align: center;
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
}

.btn-secondary {
  background: var(--gray-500);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--gray-600);
}

.pay-amount {
  color: var(--success-600);
  font-weight: var(--font-semibold);
}

.pay-rate {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.pay-empty {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* Cell Specific Styles */
.date-cell {
  display: flex;
  flex-direction: column;
}

.date-main {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.date-sub {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.employee-cell {
  display: flex;
  flex-direction: column;
}

.employee-name {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.employee-id {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.position-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.position-manager,
.position-badge-card.position-manager {
  background: var(--primary-100);
  color: var(--primary-700);
}

.position-staff,
.position-badge-card.position-staff {
  background: var(--success-100);
  color: var(--success-700);
}

.position-part_time,
.position-badge-card.position-part_time {
  background: var(--warning-100);
  color: var(--warning-700);
}

.section-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.section-kitchen,
.section-badge-card.section-kitchen {
  background: var(--danger-100);
  color: var(--danger-700);
}

.section-hall,
.section-badge-card.section-hall {
  background: var(--primary-100);
  color: var(--primary-700);
}

.section-unknown,
.section-badge-card.section-unknown {
  background: var(--gray-100);
  color: var(--gray-600);
}

.time-in, .time-out {
  font-family: var(--font-mono);
  font-weight: var(--font-medium);
}

.time-in {
  color: var(--success-600);
}

.time-out {
  color: var(--danger-600);
}

.time-empty {
  color: var(--color-text-tertiary);
  font-style: italic;
}

.duration-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.work-duration {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.extra-time {
  font-size: var(--text-xs);
  color: var(--warning-600);
  margin-top: var(--space-1);
}

/* Buttons */
.btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  font-weight: var(--font-semibold);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition: var(--transition-base);
  font-size: var(--text-sm);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-500);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-600);
}

.btn-success {
  background: var(--success-500);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: var(--success-600);
}

.btn-outline {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-medium);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-strong);
}

/* Load More */
.load-more-container {
  padding: var(--space-6);
  text-align: center;
  border-top: 1px solid var(--color-border-light);
}

.load-more-btn {
  min-width: 150px;
}

/* No Filtered Data */
.no-filtered-data {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Memo Modal Styles */
.memo-modal-content {
  background: white;
  border-radius: var(--radius-xl);
  padding: 0;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.memo-modal-body {
  padding: var(--space-6);
  max-height: 400px;
  overflow-y: auto;
}

.employee-info-section {
  background: var(--color-bg-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-6);
  text-align: center;
}

.employee-name-memo {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.memo-date {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.memo-content-section {
  background: var(--warning-50);
  border: 1px solid var(--warning-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.memo-full-content {
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--warning-800);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.memo-modal-actions {
  background: var(--color-bg-secondary);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  justify-content: flex-end;
}

/* Edit Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.edit-modal-content {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: var(--space-4);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-xl);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--space-2);
}

.modal-close:hover {
  color: var(--color-text-primary);
}

.employee-info-header {
  background: var(--color-bg-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-6);
  text-align: center;
}

.employee-name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.employee-details {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.record-date {
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.form-section {
  margin-bottom: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.form-input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-base);
  font-size: var(--text-base);
  transition: var(--transition-base);
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.calculated-info {
  background: var(--primary-50);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-6);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.info-value {
  font-weight: var(--font-semibold);
  color: var(--primary-600);
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.action-cell {
  text-align: center;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .table-row {
    grid-template-columns: 100px 120px 70px 80px 90px 90px 100px 80px 70px 90px 70px;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .filters {
    flex-wrap: wrap;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .tab-content {
    padding: var(--space-4);
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-info h2 {
    font-size: var(--text-xl);
  }
  
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: stretch;
  }
  
  .date-input, 
  .employee-filter, 
  .section-filter, 
  .status-filter {
    min-width: auto;
    padding: var(--space-3) var(--space-3);
    font-size: var(--text-sm);
  }
  
  .btn {
    grid-column: span 2;
    padding: var(--space-3) var(--space-4);
    justify-self: center;
  }
  
  .records-table-container {
    overflow-x: auto;
    border-radius: var(--radius-lg);
  }
  
  .table-row {
    grid-template-columns: 80px 100px 60px 70px 80px 80px 90px 70px 60px 80px 60px;
    min-width: 800px;
  }
  
  .data-row .table-cell {
    padding: var(--space-3) var(--space-2);
    font-size: var(--text-xs);
  }
  
  .header-row .table-cell {
    padding: var(--space-3) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
  }
  
  /* Mobile-friendly modal */
  .edit-modal-content {
    width: 95%;
    max-width: none;
    margin: 16px;
  }
  
  .employee-info-header {
    padding: var(--space-3);
  }
  
  .form-actions {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .form-actions .btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .tab-content {
    padding: var(--space-3);
  }
  
  .section-header {
    gap: 12px;
  }
  
  .header-info h2 {
    font-size: var(--text-lg);
  }
  
  .records-count {
    font-size: var(--text-xs);
  }
  
  .filters {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .btn {
    grid-column: span 1;
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
  }
  
  .table-row {
    grid-template-columns: 60px 80px 45px 55px 65px 65px 70px 55px 45px 70px 50px;
    min-width: 650px;
  }
  
  .data-row .table-cell {
    padding: var(--space-2) var(--space-1);
    font-size: 0.7rem;
  }
  
  .header-row .table-cell {
    padding: var(--space-2) var(--space-1);
    font-size: 0.7rem;
  }
  
  .employee-name {
    font-size: 0.75rem;
  }
  
  .employee-id {
    font-size: 0.65rem;
  }
  
  .date-main {
    font-size: 0.7rem;
  }
  
  .date-sub {
    font-size: 0.6rem;
  }
  
  .position-badge,
  .section-badge {
    font-size: 0.6rem;
    padding: var(--space-1);
  }
  
  .btn-sm {
    padding: 4px 8px;
    font-size: 0.7rem;
  }
  
  /* Extra small modal adjustments */
  .edit-modal-content {
    padding: var(--space-4);
  }
  
  .modal-header h3 {
    font-size: var(--text-lg);
  }
  
  .employee-name {
    font-size: var(--text-base);
  }
  
  .employee-details {
    font-size: var(--text-sm);
  }
}
</style>