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
    <Teleport to="body">
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
    </Teleport>

    <!-- Review Modal -->
    <Teleport to="body">
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
    </Teleport>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showConfirmationModal && confirmationData" class="modal-overlay" @click="closeConfirmationModal">
        <div class="modal-content confirmation-modal-content" @click.stop>
          <div class="modal-header">
            <h3><AppIcon name="check-circle" :size="20" class="mr-2" />처리 완료</h3>
            <button @click="closeConfirmationModal" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="confirmation-content">
              <!-- Success Message -->
              <div class="success-banner">
                <div class="success-icon">
                  <AppIcon name="check-circle" :size="24" />
                </div>
                <div class="success-text">
                  <h4>근무 검토가 성공적으로 완료되었습니다</h4>
                  <p>처리된 근무 기록의 세부 정보를 확인하세요.</p>
                </div>
              </div>

              <!-- Employee Info -->
              <div class="confirmation-employee-info">
                <div class="employee-info-confirmation">
                  <div
                    class="employee-avatar-confirmation"
                    :style="{ backgroundColor: confirmationData.shift?.employee?.personalColor || getDefaultColor(confirmationData.shift?.employee?.position) }"
                  >
                    {{ confirmationData.shift?.employee?.name?.charAt(0) || '?' }}
                  </div>
                  <div class="employee-details-confirmation">
                    <h4>{{ confirmationData.shift?.employee?.name || '직원' }}</h4>
                    <p>{{ getSectionText(confirmationData.shift?.employee?.section) }} · {{ getPositionText(confirmationData.shift?.employee?.position) }}</p>
                  </div>
                </div>
              </div>

              <!-- Processed Information -->
              <div class="processed-info">
                <div class="info-grid">
                  <div class="info-item">
                    <label>처리 상태</label>
                    <div class="status-badge" :class="getStatusClass(confirmationData.shift?.status)">
                      <AppIcon :name="getStatusIcon(confirmationData.shift?.status)" :size="14" />
                      {{ getStatusText(confirmationData.shift?.status) }}
                    </div>
                  </div>
                  <div class="info-item">
                    <label>최종 급여</label>
                    <div class="pay-amount">{{ formatCurrency(confirmationData.shift?.finalPayAmount || 0) }}</div>
                  </div>
                  <div class="info-item">
                    <label>실제 근무 시간</label>
                    <div class="work-time">{{ formatTime(confirmationData.shift?.startAt) }} - {{ formatTime(confirmationData.shift?.endAt) }}</div>
                  </div>
                  <div class="info-item">
                    <label>근무 시간</label>
                    <div class="work-duration">{{ confirmationData.shift?.actualMinutes || 0 }}분 ({{ confirmationData.shift?.workedMinutes || 0 }}분 근무)</div>
                  </div>
                </div>
              </div>

              <!-- Processing Details -->
              <div v-if="confirmationData.shift?.memo" class="processing-memo">
                <h5>처리 메모</h5>
                <div class="memo-display">{{ confirmationData.shift.memo }}</div>
              </div>

              <!-- Summary Information -->
              <div v-if="confirmationData.summary" class="summary-info">
                <h5>처리 요약</h5>
                <div class="summary-grid">
                  <div class="summary-item">
                    <span class="summary-label">최종 상태:</span>
                    <span class="summary-value">{{ getStatusText(confirmationData.summary.status) }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">실제 근무:</span>
                    <span class="summary-value">{{ confirmationData.summary.actualMinutes }}분</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">인정 근무:</span>
                    <span class="summary-value">{{ confirmationData.summary.workedMinutes }}분</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">급여:</span>
                    <span class="summary-value">{{ formatCurrency(confirmationData.summary.finalPayAmount) }}</span>
                  </div>
                </div>
              </div>

              <!-- Processing Time -->
              <div class="processing-time">
                <small>
                  <AppIcon name="clock" :size="12" class="mr-1" />
                  처리 시간: {{ formatDateTime(confirmationData.shift?.reviewResolvedAt) }}
                </small>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeConfirmationModal" class="btn btn-primary">
              확인
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
const showConfirmationModal = ref(false)
const selectedMemo = ref('')
const selectedReview = ref(null)
const confirmationData = ref(null)

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
    
    const result = await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, workshiftId, {
      startAt,
      endAt,
      memo: editForm.value.adminNote
    })

    console.log('✅ Review resolved successfully:', result)

    // Show confirmation modal
    showConfirmationModal.value = true
    confirmationData.value = result

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
      const result = await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, workshiftId, {
        startAt: review.actualInAt || review.startAt,
        endAt: review.actualOutAt || review.endAt,
        memo: '관리자 승인 처리'
      })

      console.log('✅ Quick approve resolved successfully:', result)

      // Show confirmation modal
      showConfirmationModal.value = true
      confirmationData.value = result
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

    const result = await workshiftStore.resolveReviewWorkshift(authStore.user.shopId, selectedReview.value.id, {
      startAt,
      endAt,
      memo: editForm.value.adminNote
    })

    console.log('✅ Review modal resolved successfully:', result)

    // Show confirmation modal
    showConfirmationModal.value = true
    confirmationData.value = result

    // Close review modal
    closeReviewModal()
  } catch (err) {
    console.error('Failed to update workshift:', err)
    alert('근무 시간 승인 처리 중 오류가 발생했습니다.')
  }
}

// Confirmation modal methods
const closeConfirmationModal = () => {
  showConfirmationModal.value = false
  confirmationData.value = null
}

const getStatusClass = (status) => {
  const classes = {
    'COMPLETED': 'status-completed',
    'CANCELLED': 'status-cancelled',
    'SCHEDULED': 'status-scheduled'
  }
  return classes[status] || 'status-default'
}

const getStatusIcon = (status) => {
  const icons = {
    'COMPLETED': 'check-circle',
    'CANCELLED': 'x-circle',
    'SCHEDULED': 'clock'
  }
  return icons[status] || 'help-circle'
}

const getStatusText = (status) => {
  const texts = {
    'COMPLETED': '완료',
    'CANCELLED': '취소됨',
    'SCHEDULED': '예정'
  }
  return texts[status] || status
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

</script>

<style scoped src="@/assets/styles/admin/ReviewAlert.css"></style>
