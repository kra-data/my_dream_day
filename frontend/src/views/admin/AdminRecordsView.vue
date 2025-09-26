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
import StatusBadge from '@/components/common/alarm/StatusBadge.vue'
import AppIcon from '@/components/common/AppIcon.vue'
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

<style scoped src="@/assets/styles/views/admin/AdminRecordsView.css"></style>
