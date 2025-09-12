<template>
  <div v-if="reviewCount > 0" class="admin-review-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="header-content">
        <AppIcon name="warning" :size="24" class="header-icon" />
        <div class="header-text">
          <h3>근무 이상 현황 검토</h3>
          <p>{{ reviewCount }}건의 근무 기록이 관리자 확인을 기다리고 있습니다</p>
        </div>
      </div>
      <div class="header-actions">
        <button @click="toggleExpanded" class="btn-toggle">
          <AppIcon :name="isExpanded ? 'chevron-up' : 'chevron-down'" :size="16" />
          {{ isExpanded ? '접기' : '펼치기' }}
        </button>
        <button @click="refreshReviews" class="btn-refresh">
          <AppIcon name="refresh" :size="16" />
          새로고침
        </button>
      </div>
    </div>

    <!-- Review Tasks Table -->
    <div v-if="isExpanded" class="review-tasks">
      <div class="review-table">
        <div class="table-header">
          <div class="table-row header-row">
            <div class="table-cell">직원</div>
            <div class="table-cell">검토 사유</div>
            <div class="table-cell">예정 시간</div>
            <div class="table-cell">실제 시간</div>
            <div class="table-cell">메모</div>
            <div class="table-cell">관리</div>
          </div>
        </div>
        
        <div class="table-body">
          <div 
            v-for="review in reviewWorkshifts" 
            :key="review.id"
            class="table-row data-row"
            :class="getPriorityClass(review)"
          >
            <!-- 직원 정보 -->
            <div class="table-cell employee-cell">
              <div class="employee-info-table">
                <div 
                  class="employee-avatar-table" 
                  :style="{ backgroundColor: review.employee.personalColor || getDefaultColor(review.employee.position) }"
                >
                  {{ review.employee.name.charAt(0) }}
                </div>
                <div class="employee-details-table">
                  <div class="employee-name-table">{{ review.employee.name }}</div>
                  <div class="employee-meta-table">
                    {{ getSectionText(review.employee.section) }} · {{ getPositionText(review.employee.position) }}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 검토 사유 -->
            <div class="table-cell issue-cell">
              <div class="issue-info">
                <div class="issue-badge-table" :class="getIssueClass(review.reviewReason)">
                  <AppIcon :name="getIssueIcon(review.reviewReason)" :size="12" />
                  {{ getIssueDescription(review.reviewReason) }}
                </div>
                <div class="issue-detail-text">{{ getIssueDetail(review) }}</div>
                <div class="priority-badge-table" :class="getPriorityClass(review)">
                  {{ getPriorityText(review) }}
                </div>
              </div>
            </div>
            
            <!-- 예정 시간 -->
            <div class="table-cell time-cell">
              <div class="time-info-table">
                <div class="time-range">{{ formatTime(review.startAt) }} - {{ formatTime(review.endAt) }}</div>
                <div class="duration-info">{{ getScheduledDuration(review) }}분</div>
              </div>
            </div>
            
            <!-- 실제 시간 -->
            <div class="table-cell time-cell">
              <div class="time-info-table actual" :class="{ 'has-issues': hasTimeIssues(review) }">
                <div class="time-range">
                  <span :class="{ missing: !review.actualInAt, late: isLate(review) }">
                    {{ review.actualInAt ? formatTime(review.actualInAt) : '미기록' }}
                  </span>
                  <span> - </span>
                  <span :class="{ missing: !review.actualOutAt, early: isEarly(review) }">
                    {{ review.actualOutAt ? formatTime(review.actualOutAt) : '미기록' }}
                  </span>
                </div>
                <div class="duration-info">{{ review.actualMinutes || 0 }}봄</div>
              </div>
            </div>
            
            <!-- 메모 -->
            <div class="table-cell memo-cell">
              <span 
                v-if="review.memo" 
                class="memo-text-table clickable" 
                :title="review.memo"
                @click="openMemoModal(review)"
              >
                {{ review.memo.length > 10 ? review.memo.substring(0, 10) + '...' : review.memo }}
              </span>
              <span v-else class="memo-empty-table">-</span>
            </div>
            
            <!-- 관리 버튼 -->
            <div class="table-cell action-cell">
              <div v-if="editingReview !== review.id" class="action-buttons-table">
                <button @click="openReviewModal(review)" class="btn-review-table">
                  <AppIcon name="eye" :size="12" />
                  검토
                </button>
                <button @click="quickApprove(review.id)" class="btn-approve-table">
                  <AppIcon name="check" :size="12" />
                  승인
                </button>
              </div>
              
              <!-- 수정 폼 -->
              <div v-if="editingReview === review.id" class="edit-form-inline">
                <div class="edit-form-compact">
                  <div class="form-row">
                    <input type="datetime-local" v-model="editForm.startAt" class="form-input-compact" placeholder="출근" />
                    <input type="datetime-local" v-model="editForm.endAt" class="form-input-compact" placeholder="퇴근" />
                  </div>
                  <textarea 
                    v-model="editForm.adminNote"
                    placeholder="처리 메모"
                    class="form-textarea-compact"
                    rows="2"
                  ></textarea>
                  <div class="form-actions-compact">
                    <button @click="cancelEdit" class="btn-cancel-compact">
                      취소
                    </button>
                    <button @click="confirmUpdate(review.id)" class="btn-confirm-compact">
                      승인
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Memo Modal -->
    <div v-if="showMemoModal" class="modal-overlay" @click="closeMemoModal">
      <div class="modal-content memo-modal-content" @click.stop>
        <div class="modal-header">
          <h3><AppIcon name="message-square" :size="20" class="mr-2" />메모 내용</h3>
          <button @click="closeMemoModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="memo-content-display">
            {{ selectedMemo }}
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeMemoModal" class="btn btn-primary">
            확인
          </button>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <div v-if="showReviewModal && selectedReview" class="modal-overlay" @click="closeReviewModal">
      <div class="modal-content review-modal-content" @click.stop>
        <div class="modal-header">
          <h3><AppIcon name="eye" :size="20" class="mr-2" />근무 기록 검토</h3>
          <button @click="closeReviewModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Employee Info -->
          <div class="review-employee-info">
            <div class="employee-info-modal">
              <div 
                class="employee-avatar-modal" 
                :style="{ backgroundColor: selectedReview.employee.personalColor || getDefaultColor(selectedReview.employee.position) }"
              >
                {{ selectedReview.employee.name.charAt(0) }}
              </div>
              <div class="employee-details-modal">
                <h4>{{ selectedReview.employee.name }}</h4>
                <p>{{ getSectionText(selectedReview.employee.section) }} · {{ getPositionText(selectedReview.employee.position) }}</p>
              </div>
            </div>
          </div>

          <!-- Issue Details -->
          <div class="issue-details-modal">
            <h4>검토 사유</h4>
            <div class="issue-badge-modal" :class="getIssueClass(selectedReview.reviewReason)">
              <AppIcon :name="getIssueIcon(selectedReview.reviewReason)" :size="16" />
              {{ getIssueDescription(selectedReview.reviewReason) }}
            </div>
            <p class="issue-detail-text">{{ getIssueDetail(selectedReview) }}</p>
          </div>

          <!-- Time Comparison -->
          <div class="time-comparison-modal">
            <div class="time-section">
              <h4>예정 시간</h4>
              <div class="time-display-modal scheduled">
                {{ formatTime(selectedReview.startAt) }} - {{ formatTime(selectedReview.endAt) }}
                <span class="duration">({{ getScheduledDuration(selectedReview) }}분)</span>
              </div>
            </div>
            <div class="time-section">
              <h4>실제 시간</h4>
              <div class="time-display-modal actual">
                <span :class="{ missing: !selectedReview.actualInAt }">
                  {{ selectedReview.actualInAt ? formatTime(selectedReview.actualInAt) : '미기록' }}
                </span>
                <span> - </span>
                <span :class="{ missing: !selectedReview.actualOutAt }">
                  {{ selectedReview.actualOutAt ? formatTime(selectedReview.actualOutAt) : '미기록' }}
                </span>
                <span class="duration">({{ selectedReview.actualMinutes || 0 }}분)</span>
              </div>
            </div>
          </div>

          <!-- Employee Memo -->
          <div v-if="selectedReview.memo" class="employee-memo-modal">
            <h4>직원 메모</h4>
            <div class="memo-content">{{ selectedReview.memo }}</div>
          </div>

          <!-- Edit Form -->
          <div class="edit-form-modal">
            <h4>시간 수정 및 승인</h4>
            <div class="form-grid-modal">
              <div class="form-group">
                <label for="modal-start">출근 시간</label>
                <input 
                  id="modal-start"
                  type="datetime-local" 
                  v-model="editForm.startAt" 
                  class="form-input-modal" 
                />
              </div>
              <div class="form-group">
                <label for="modal-end">퇴근 시간</label>
                <input 
                  id="modal-end"
                  type="datetime-local" 
                  v-model="editForm.endAt" 
                  class="form-input-modal" 
                />
              </div>
            </div>
            <div class="form-group">
              <label for="modal-admin-note">관리자 메모</label>
              <textarea 
                id="modal-admin-note"
                v-model="editForm.adminNote"
                placeholder="승인 처리에 대한 메모를 입력하세요"
                class="form-textarea-modal"
                rows="3"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeReviewModal" class="btn btn-secondary">
            취소
          </button>
          <button @click="confirmReviewUpdate" class="btn btn-primary">
            승인 처리
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/AppIcon.vue'

const workshiftStore = useWorkshiftStore()
const authStore = useAuthStore()

const isExpanded = ref(false)
const editingReview = ref(null)
const editForm = ref({
  startAt: '',
  endAt: '',
  status: 'SCHEDULED',
  adminNote: ''
})

// Modal states
const showMemoModal = ref(false)
const showReviewModal = ref(false)
const selectedMemo = ref('')
const selectedReview = ref(null)

// Computed properties
const reviewWorkshifts = computed(() => workshiftStore.reviewWorkshifts || [])
const reviewCount = computed(() => reviewWorkshifts.value.length)

// Methods
const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const getScheduledDuration = (review) => {
  const start = new Date(review.startAt)
  const end = new Date(review.endAt)
  return Math.round((end - start) / (1000 * 60))
}

const getPositionText = (position) => {
  const positions = {
    'FULL_TIME': '정규직',
    'PART_TIME': '시간제',
    'CONTRACT': '계약직',
    'INTERN': '인턴'
  }
  return positions[position] || position
}

const getSectionText = (section) => {
  const sections = {
    'HALL': '홀',
    'KITCHEN': '주방',
    'COUNTER': '카운터',
    'MANAGEMENT': '관리'
  }
  return sections[section] || section
}

const formatDateTimeForInput = (dateString) => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}


const cancelEdit = () => {
  editingReview.value = null
  editForm.value = {
    startAt: '',
    endAt: '',
    status: 'SCHEDULED',
    adminNote: ''
  }
}

const confirmUpdate = async (workshiftId) => {
  try {
    // 출근시간과 퇴근시간 둘 다 필수 입력 검증
    if (!editForm.value.startAt || !editForm.value.endAt) {
      alert('출근 시간과 퇴근 시간을 모두 입력해야 합니다.')
      return
    }

    // 시간 유효성 검증
    const startTime = new Date(editForm.value.startAt)
    const endTime = new Date(editForm.value.endAt)
    
    if (startTime >= endTime) {
      alert('퇴근 시간은 출근 시간보다 늦어야 합니다.')
      return
    }

    // Convert datetime-local format back to ISO string
    const startAt = startTime.toISOString()
    const endAt = endTime.toISOString()
    
    await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, workshiftId, editForm.value.status, {
      startAt,
      endAt,
      adminNote: editForm.value.adminNote
    })
    
    // Reset form
    cancelEdit()
  } catch (err) {
    console.error('Failed to update workshift:', err)
    alert('근무 시간 승인 처리 중 오류가 발생했습니다.')
  }
}

const getDefaultColor = (position) => {
  const positionColors = {
    'OWNER': '#8b5cf6',
    'MANAGER': '#06b6d4',
    'STAFF': '#10b981',
    'PART_TIME': '#f59e0b'
  }
  return positionColors[position] || '#3b82f6'
}

// New administrative methods
const refreshReviews = async () => {
  try {
    await workshiftStore.fetchReviewWorkshifts(authStore.user.shopId)
  } catch (error) {
    console.error('Failed to refresh reviews:', error)
  }
}

const getPriorityClass = (review) => {
  if (!review.actualInAt && !review.actualOutAt) return 'critical'
  if (!review.actualInAt || !review.actualOutAt) return 'high'
  if (review.late || review.leftEarly) return 'medium'
  return 'low'
}


const getPriorityText = (review) => {
  const priority = getPriorityClass(review)
  const texts = {
    critical: '긴급',
    high: '높음',
    medium: '보통',
    low: '낮음'
  }
  return texts[priority]
}

const getIssueClass = (reviewReason) => {
  const classes = {
    'LATE_IN': 'late-issue',
    'EARLY_OUT': 'early-issue',
    'LATE_OUT': 'overtime-issue',
    'MISSING_IN': 'missing-issue',
    'MISSING_OUT': 'missing-issue',
    'OVERTIME': 'overtime-issue'
  }
  return classes[reviewReason] || 'default-issue'
}

const getIssueIcon = (reviewReason) => {
  const icons = {
    'LATE_IN': 'clock',
    'EARLY_OUT': 'arrow-left',
    'LATE_OUT': 'clock',
    'MISSING_IN': 'x-circle',
    'MISSING_OUT': 'x-circle',
    'OVERTIME': 'clock'
  }
  return icons[reviewReason] || 'warning'
}

const getIssueDescription = (reviewReason) => {
  const descriptions = {
    'LATE_IN': '지각 출근',
    'EARLY_OUT': '조기 퇴근',
    'LATE_OUT': '초과 근무',
    'MISSING_IN': '출근 미기록',
    'MISSING_OUT': '퇴근 미기록',
    'OVERTIME': '연장 근무'
  }
  return descriptions[reviewReason] || '기타 이상'
}

const getIssueDetail = (review) => {
  const reason = review.reviewReason
  const scheduledStart = new Date(review.startAt)
  const scheduledEnd = new Date(review.endAt)
  const actualStart = review.actualInAt ? new Date(review.actualInAt) : null
  const actualEnd = review.actualOutAt ? new Date(review.actualOutAt) : null

  if (reason === 'MISSING_IN') {
    return '출근 시간이 기록되지 않았습니다.'
  }
  
  if (reason === 'MISSING_OUT') {
    return '퇴근 시간이 기록되지 않았습니다.'
  }
  
  if (reason === 'LATE_IN' && actualStart) {
    const minutesLate = Math.round((actualStart - scheduledStart) / (1000 * 60))
    return `예정 시간보다 ${minutesLate}분 늦게 출근했습니다.`
  }
  
  if (reason === 'EARLY_OUT' && actualEnd) {
    const minutesEarly = Math.round((scheduledEnd - actualEnd) / (1000 * 60))
    return `예정 시간보다 ${minutesEarly}분 일찍 퇴근했습니다.`
  }

  if (reason === 'LATE_OUT' && actualEnd) {
    const minutesLate = Math.round((actualEnd - scheduledEnd) / (1000 * 60))
    return `예정 시간보다 ${minutesLate}분 늦게 퇴근했습니다.`
  }

  return '예정된 근무 시간과 실제 근무 시간에 차이가 있습니다.'
}

const hasTimeIssues = (review) => {
  return !review.actualInAt || !review.actualOutAt || review.late || review.leftEarly
}

const isLate = (review) => {
  return review.late && review.actualInAt
}

const isEarly = (review) => {
  return review.leftEarly && review.actualOutAt
}

const quickApprove = async (workshiftId) => {
  // 해당 근무 기록 찾기
  const review = reviewWorkshifts.value.find(r => r.id === workshiftId)
  
  if (!review) {
    alert('근무 기록을 찾을 수 없습니다.')
    return
  }

  // 출근 또는 퇴근 기록이 있는지 확인
  if (!review.actualInAt && !review.actualOutAt) {
    alert('출근 또는 퇴근 기록이 있어야 승인할 수 있습니다.\n직원이 출퇴근 체크를 하지 않은 경우 "검토하기"를 통해 수동으로 시간을 입력해주세요.')
    return
  }

  if (confirm('이 근무 기록을 현재 상태로 승인하시겠습니까?')) {
    try {
      await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, workshiftId, 'COMPLETED', {
        adminNote: '관리자 승인 처리'
      })
    } catch (error) {
      console.error('Failed to approve workshift:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    }
  }
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

// Modal methods
const openMemoModal = (review) => {
  selectedMemo.value = review.memo || ''
  showMemoModal.value = true
}

const closeMemoModal = () => {
  showMemoModal.value = false
  selectedMemo.value = ''
}

const openReviewModal = (review) => {
  selectedReview.value = review
  showReviewModal.value = true
  
  // Set form data for the review modal
  const actualStartAt = review.actualInAt ? formatDateTimeForInput(review.actualInAt) : formatDateTimeForInput(review.startAt)
  const actualEndAt = review.actualOutAt ? formatDateTimeForInput(review.actualOutAt) : formatDateTimeForInput(review.endAt)
  
  editForm.value = {
    startAt: actualStartAt,
    endAt: actualEndAt,
    status: 'SCHEDULED',
    adminNote: ''
  }
}

const closeReviewModal = () => {
  showReviewModal.value = false
  selectedReview.value = null
  editForm.value = {
    startAt: '',
    endAt: '',
    status: 'SCHEDULED',
    adminNote: ''
  }
}

const confirmReviewUpdate = async () => {
  if (!selectedReview.value) return
  
  try {
    // 출근시간과 퇴근시간 둘 다 필수 입력 검증
    if (!editForm.value.startAt || !editForm.value.endAt) {
      alert('출근 시간과 퇴근 시간을 모두 입력해야 합니다.')
      return
    }

    // 시간 유효성 검증
    const startTime = new Date(editForm.value.startAt)
    const endTime = new Date(editForm.value.endAt)
    
    if (startTime >= endTime) {
      alert('퇴근 시간은 출근 시간보다 늦어야 합니다.')
      return
    }

    // Convert datetime-local format back to ISO string
    const startAt = startTime.toISOString()
    const endAt = endTime.toISOString()
    
    await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, selectedReview.value.id, editForm.value.status, {
      startAt,
      endAt,
      adminNote: editForm.value.adminNote
    })
    
    // Close modal
    closeReviewModal()
  } catch (err) {
    console.error('Failed to update workshift:', err)
    alert('근무 시간 승인 처리 중 오류가 발생했습니다.')
  }
}

</script>

<style scoped>
/* Admin Review Panel */
.admin-review-panel {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
  border-bottom: 1px solid #fecaca;
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-icon {
  color: #dc2626;
  padding: var(--space-2);
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-full);
}

.header-text h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: #1f2937;
}

.header-text p {
  margin: var(--space-1) 0 0 0;
  font-size: var(--text-sm);
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-toggle, .btn-refresh {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: white;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-lg);
  color: #374151;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-toggle:hover, .btn-refresh:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-1px);
}

/* Review Tasks Table */
.review-tasks {
  padding: var(--space-6);
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
}

.review-table {
  width: 100%;
}

.table-header {
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-medium);
}

.table-row {
  display: grid;
  grid-template-columns: 140px 160px 80px 100px 100px 100px 120px 80px;
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

/* Employee Cell */
.employee-cell {
  display: flex;
  flex-direction: column;
}

.employee-info-table {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.employee-avatar-table {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.employee-name-table {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.employee-meta-table {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

/* Issue Badge */
.issue-badge-table {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.issue-badge-table.late-issue {
  background: var(--danger-100);
  color: var(--danger-700);
}

.issue-badge-table.early-issue {
  background: var(--warning-100);
  color: var(--warning-700);
}

.issue-badge-table.missing-issue {
  background: var(--danger-100);
  color: var(--danger-700);
}

.issue-badge-table.overtime-issue {
  background: var(--primary-100);
  color: var(--primary-700);
}

/* Time Cell */
.time-cell {
  font-family: var(--font-mono);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.time-range {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.time-range .missing {
  color: var(--danger-600);
  font-style: italic;
}

.time-range .late {
  color: var(--danger-600);
}

.time-range .early {
  color: var(--warning-600);
}

/* Memo Cell */
.memo-cell {
  max-width: 100px;
}

.memo-text-table {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
}

.memo-text-table.clickable {
  cursor: pointer;
  color: var(--primary-600);
  transition: var(--transition-base);
}

.memo-text-table.clickable:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

.memo-empty-table {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* Action Cell */
.action-cell {
  text-align: center;
}

.btn-review-table,
.btn-approve-table {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  font-weight: var(--font-semibold);
  transition: var(--transition-base);
  margin: 0 2px;
}

.btn-review-table {
  background: var(--warning-500);
  color: white;
}

.btn-review-table:hover {
  background: var(--warning-600);
}

.btn-approve-table {
  background: var(--success-500);
  color: white;
}

.btn-approve-table:hover {
  background: var(--success-600);
}

/* Inline Edit Form */
.edit-form-inline {
  padding: var(--space-3);
  background: #f9fafb;
  border-radius: var(--radius-md);
  border: 1px solid #e5e7eb;
}

.edit-form-compact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-row {
  display: flex;
  gap: var(--space-2);
}

.form-input-compact {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.form-textarea-compact {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  resize: none;
}

.form-actions-compact {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.btn-cancel-compact,
.btn-confirm-compact {
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel-compact {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-cancel-compact:hover {
  background: #e5e7eb;
}

.btn-confirm-compact {
  background: #10b981;
  color: white;
}

.btn-confirm-compact:hover {
  background: #059669;
}

.issue-badge-table.late-issue {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.issue-badge-table.early-issue {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.issue-badge-table.missing-issue {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.issue-badge-table.overtime-issue {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.priority-badge-table.critical {
  color: #dc2626;
}

.priority-badge-table.high {
  color: #d97706;
}

.priority-badge-table.medium {
  color: #16a34a;
}

.priority-badge-table.low {
  color: #64748b;
}

/* Compact Issue Detail */
.issue-detail-compact {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  background: #f9fafb;
  border-radius: var(--radius-sm);
  border-left: 3px solid #dc2626;
}

.issue-text {
  margin: 0;
  font-size: var(--text-xs);
  color: #374151;
  line-height: 1.3;
  font-weight: var(--font-medium);
}

.task-priority {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  border: 2px solid transparent;
}

.task-priority.critical {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.task-priority.high {
  background: #fef3c7;
  color: #d97706;
  border-color: #fde68a;
}

.task-priority.medium {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}

.task-priority.low {
  background: #f8fafc;
  color: #64748b;
  border-color: #e2e8f0;
}

/* Issue Description */
.issue-description {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  background: #f9fafb;
  border-radius: var(--radius-lg);
  border-left: 4px solid #dc2626;
}

.issue-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
}

.issue-badge.late-issue {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.issue-badge.early-issue {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.issue-badge.missing-issue {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.issue-badge.overtime-issue {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.issue-detail {
  margin: 0;
  font-size: var(--text-sm);
  color: #374151;
  line-height: 1.5;
}

/* Attendance and Actions Container */
.attendance-and-actions {
  display: flex;
  align-items: stretch;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

/* Attendance Comparison - Expanded */
.attendance-comparison-compact {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: var(--radius-lg);
  border: 2px solid #cbd5e1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  flex: 1;
}

.comparison-section h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: #6b7280;
  margin: 0 0 var(--space-2) 0;
  text-align: center;
}

.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: white;
  border: 2px solid transparent;
}

.time-display.scheduled {
  border-color: #10b981;
}

.time-display.actual.has-issues {
  border-color: #dc2626;
  background: #fef2f2;
}

.time {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: #1f2937;
}

.time.missing {
  color: #dc2626;
  font-style: italic;
  font-weight: var(--font-medium);
}

.time.late {
  color: #dc2626;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.time.early {
  color: #d97706;
  background: #fef3c7;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.separator {
  font-size: var(--text-lg);
  color: #9ca3af;
  font-weight: var(--font-bold);
}

.duration {
  font-size: var(--text-sm);
  color: #6b7280;
  font-weight: var(--font-medium);
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: var(--radius-md);
}

.comparison-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

/* Employee Memo - Compact but Prominent */
.employee-memo-prominent {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.12);
}

.memo-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: #92400e;
}

.memo-content {
  margin: 0;
  font-size: var(--text-sm);
  color: #92400e;
  line-height: 1.4;
  font-weight: var(--font-medium);
  background: rgba(255, 255, 255, 0.6);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border-left: 3px solid #f59e0b;
}

/* Compact Resolution Actions */
.resolution-actions {
  border-top: 1px solid #f3f4f6;
  padding-top: var(--space-3);
  margin-top: var(--space-3);
}

.edit-form {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-xl);
  padding: var(--space-5);
}

.form-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: #1f2937;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: #374151;
}

.form-input, .form-textarea {
  padding: var(--space-3);
  border: 2px solid #e5e7eb;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  background: white;
  transition: all var(--transition-fast);
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-4);
}

/* Inline Action Buttons */
.action-buttons-inline {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: stretch;
  min-width: 100px;
}

.btn-review-inline, .btn-approve-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  line-height: 1.2;
  text-align: center;
}

.btn-review-inline {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.btn-review-inline:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.btn-approve-inline {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-approve-inline:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.action-buttons-compact {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
  margin-top: var(--space-2);
}

.btn-review-small, .btn-approve-small {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  line-height: 1.2;
}

.btn-review-small {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.btn-review-small:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.btn-approve-small {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-approve-small:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.btn-cancel, .btn-confirm, .btn-review, .btn-quick-approve {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px solid transparent;
}

.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.btn-cancel:hover {
  background: #e5e7eb;
  color: #374151;
}

.btn-confirm {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-confirm:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
}

.btn-review {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.btn-review:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2);
}

.btn-quick-approve {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-quick-approve:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
}


/* Edit Section */
.edit-section {
  margin-top: var(--space-4);
  border-top: 1px solid #f1f5f9;
  padding-top: var(--space-4);
}

.edit-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  color: #374151;
  font-weight: var(--font-semibold);
}

.edit-form {
  background: #f8fafc;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1px solid #e2e8f0;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-group label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: #374151;
  margin-bottom: var(--space-1);
}

.time-input, .status-input {
  padding: var(--space-2);
  border: 1px solid #d1d5db;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: white;
  transition: all var(--transition-fast);
}

.time-input:focus, .status-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.memo-group {
  margin-bottom: var(--space-4);
}

.memo-group label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: #374151;
  margin-bottom: var(--space-1);
  display: block;
}

.memo-input {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid #d1d5db;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: white;
  resize: vertical;
  min-height: 60px;
  transition: all var(--transition-fast);
}

.memo-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.edit-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.btn-secondary, .btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}



/* Responsive Design */
/* Responsive Design */
@media (max-width: 1200px) {
  .table-row {
    grid-template-columns: 120px 140px 70px 90px 90px 90px 100px 70px;
  }
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    gap: var(--space-3);
    align-items: stretch;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .review-tasks {
    padding: var(--space-2);
    overflow-x: auto;
  }
  
  .table-row {
    grid-template-columns: 100px 120px 60px 80px 80px 80px 90px 60px;
    min-width: 670px;
  }
  
  .data-row .table-cell {
    padding: var(--space-2) var(--space-1);
    font-size: var(--text-xs);
  }
  
  .header-row .table-cell {
    padding: var(--space-2) var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .review-tasks {
    padding: var(--space-1);
  }
  
  .table-row {
    grid-template-columns: 80px 100px 45px 60px 60px 60px 70px 45px;
    min-width: 520px;
  }
  
  .data-row .table-cell {
    padding: var(--space-1);
    font-size: 0.7rem;
  }
  
  .header-row .table-cell {
    padding: var(--space-1);
    font-size: 0.7rem;
    font-weight: var(--font-bold);
  }
  
  .employee-name-table {
    font-size: 0.75rem;
  }
  
  .employee-meta-table {
    font-size: 0.65rem;
  }
  
  .time-range {
    font-size: 0.7rem;
  }
  
  .duration-info {
    font-size: 0.6rem;
  }
  
  .issue-badge-table {
    font-size: 0.6rem;
    padding: 1px 4px;
  }
  
  .btn-review-table,
  .btn-approve-table {
    padding: 3px 6px;
    font-size: 0.7rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
}

/* Modal Styles */
.modal-overlay {
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

.modal-content {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  max-height: 90vh;
  overflow-y: auto;
}

.memo-modal-content {
  width: 90%;
  max-width: 500px;
}

.review-modal-content {
  width: 90%;
  max-width: 800px;
}

.modal-header {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: #1f2937;
  display: flex;
  align-items: center;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  background: #f9fafb;
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Memo Modal Specific */
.memo-content-display {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: #374151;
  min-height: 100px;
  white-space: pre-wrap;
}

/* Review Modal Specific */
.review-employee-info {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%);
  border-radius: var(--radius-lg);
  border: 1px solid #bfdbfe;
}

.employee-info-modal {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.employee-avatar-modal {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  font-size: var(--text-xl);
  flex-shrink: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.employee-details-modal h4 {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: #1f2937;
}

.employee-details-modal p {
  margin: 0;
  font-size: var(--text-sm);
  color: #6b7280;
  font-weight: var(--font-medium);
}

.issue-details-modal {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: #fef2f2;
  border-radius: var(--radius-lg);
  border: 1px solid #fecaca;
}

.issue-details-modal h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: #1f2937;
}

.issue-badge-modal {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-3);
}

.issue-detail-text {
  margin: 0;
  font-size: var(--text-sm);
  color: #374151;
  line-height: 1.5;
}

.time-comparison-modal {
  margin-bottom: var(--space-6);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.time-section h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: #1f2937;
}

.time-display-modal {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 2px solid #e5e7eb;
  background: white;
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
}

.time-display-modal.scheduled {
  border-color: #10b981;
  background: #f0fdf4;
  color: #065f46;
}

.time-display-modal.actual {
  border-color: #f59e0b;
  background: #fefbf2;
  color: #92400e;
}

.time-display-modal .duration {
  font-size: var(--text-sm);
  color: #6b7280;
  font-weight: var(--font-normal);
  margin-left: var(--space-2);
}

.time-display-modal .missing {
  color: #dc2626;
  font-style: italic;
}

.employee-memo-modal {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: #fef3c7;
  border-radius: var(--radius-lg);
  border: 1px solid #fde68a;
}

.employee-memo-modal h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: #92400e;
}

.employee-memo-modal .memo-content {
  background: rgba(255, 255, 255, 0.7);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: #92400e;
}

.edit-form-modal {
  padding: var(--space-4);
  background: #f8fafc;
  border-radius: var(--radius-lg);
  border: 1px solid #e2e8f0;
}

.edit-form-modal h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: #1f2937;
}

.form-grid-modal {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: #374151;
}

.form-input-modal,
.form-textarea-modal {
  padding: var(--space-3);
  border: 2px solid #e5e7eb;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: white;
  transition: all var(--transition-fast);
}

.form-input-modal:focus,
.form-textarea-modal:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea-modal {
  resize: vertical;
  font-family: inherit;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.btn-secondary {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
  color: #374151;
}

.mr-2 {
  margin-right: var(--space-2);
}

@media (max-width: 768px) {
  .review-modal-content {
    width: 95%;
    max-width: none;
  }
  
  .time-comparison-modal {
    grid-template-columns: 1fr;
  }
  
  .form-grid-modal {
    grid-template-columns: 1fr;
  }
  
  .modal-header {
    padding: var(--space-3) var(--space-4);
  }
  
  .modal-body {
    padding: var(--space-4);
  }
  
  .modal-footer {
    padding: var(--space-3) var(--space-4);
    flex-direction: column-reverse;
  }
}
</style>