<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="edit" :size="18" class="inline-block mr-2" />
          근무 일정 변경 요청
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      
      <div class="modal-body">
        <!-- 현재 일정 정보 -->
        <div class="current-shift-info">
          <h4>
            <AppIcon name="calendar" :size="16" class="inline-block mr-2" />
            현재 일정
          </h4>
          <div class="shift-details">
            <div class="detail-item">
              <span class="detail-label">날짜:</span>
              <span class="detail-value">{{ formatDate(shift.startAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">시간:</span>
              <span class="detail-value">{{ formatShiftTime(shift.startAt, shift.endAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">근무 시간:</span>
              <span class="detail-value">{{ getShiftDuration(shift.startAt, shift.endAt) }}</span>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSubmit">

          <!-- 시간 변경 -->
            <!-- 새 시작 시간 -->
            <div class="form-group">
              <label for="newStartTime">새 시작 시간 *</label>
              <input
                id="newStartTime"
                v-model="form.newStartTime"
                type="time"
                required
                class="form-control"
              >
            </div>

            <!-- 새 종료 시간 -->
            <div class="form-group">
              <label for="newEndTime">새 종료 시간 *</label>
              <input
                id="newEndTime"
                v-model="form.newEndTime"
                type="time"
                required
                class="form-control"
              >
            </div>

            <!-- 변경 후 근무 시간 미리보기 -->
            <div v-if="isValidNewTime" class="time-preview">
              <h5>🔄 변경 후 일정</h5>
              <div class="preview-item">
                <span class="preview-label">근무 시간:</span>
                <span class="preview-value">{{ newWorkDuration }}</span>
              </div>
            </div>

          <!-- 변경 사유 -->
          <div class="form-group">
            <label for="reason">시간 변경 사유 *</label>
            <textarea
              id="reason"
              v-model="form.reason"
              required
              class="form-control"
              rows="3"
              placeholder="시간 변경 사유를 상세히 작성해주세요 (관리자 승인에 참고됩니다)"
            ></textarea>
          </div>

          <!-- 안내 메시지 -->
          <div class="warning-message">
            <div class="warning-icon">
              <AppIcon name="warning" :size="16" />
            </div>
            <div class="warning-content">
              <p><strong>변경 요청 안내</strong></p>
              <ul>
                <li>변경 요청은 관리자 승인이 필요합니다</li>
                <li>급한 경우 직접 관리자에게 연락해주세요</li>
              </ul>
            </div>
          </div>

          <!-- 에러 메시지 -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- 버튼들 -->
          <div class="modal-actions">
            <button type="button" @click="$emit('close')" class="btn btn-secondary">
              취소
            </button>
            <button type="submit" :disabled="!isFormValid || loading" class="btn btn-warning">
              <span v-if="loading">요청 중...</span>
              <span v-else>변경 요청</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 수정 성공 모달 -->
  <div v-if="showSuccessModal" class="modal-backdrop" @click="handleSuccessModalClose">
    <div class="modal success-modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="check-circle" :size="18" class="inline-block mr-2 text-success" />
          근무 일정 수정 완료
        </h3>
        <button @click="handleSuccessModalClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 성공 메시지 -->
        <div class="success-message">
          <div class="success-icon">
            <AppIcon name="check" :size="24" />
          </div>
          <div class="success-content">
            <p><strong>근무 일정이 성공적으로 수정되었습니다!</strong></p>
          </div>
        </div>

        <!-- 수정된 일정 정보 -->
        <div v-if="successData && successData.shift" class="updated-shift-info">
          <h4>
            <AppIcon name="calendar" :size="16" class="inline-block mr-2" />
            수정된 일정
          </h4>
          <div class="shift-details">
            <div class="detail-item">
              <span class="detail-label">날짜:</span>
              <span class="detail-value">{{ formatDate(successData.shift.startAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">시간:</span>
              <span class="detail-value">{{ formatShiftTime(successData.shift.startAt, successData.shift.endAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">근무 시간:</span>
              <span class="detail-value">{{ getShiftDuration(successData.shift.startAt, successData.shift.endAt) }}</span>
            </div>
            <div v-if="successData.shift.memo" class="detail-item">
              <span class="detail-label">메모:</span>
              <span class="detail-value">{{ successData.shift.memo }}</span>
            </div>
          </div>
        </div>

        <!-- 버튼 -->
        <div class="modal-actions">
          <button @click="handleSuccessModalClose" class="btn btn-success">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'

export default {
  name: 'EmployeeWorkshiftEditModal',
  props: {
    shift: {
      type: Object,
      required: true
    }
  },
  emits: ['update', 'close'],
  setup(props, { emit }) {
    const workshiftStore = useWorkshiftStore()
    const loading = ref(false)
    const error = ref('')
    const showSuccessModal = ref(false)
    const successData = ref(null)
    
    const form = ref({
      newStartTime: '',
      newEndTime: '',
      reason: ''
    })
    
    // 폼 유효성 검사
    const isFormValid = computed(() => {
      return form.value.newStartTime &&
             form.value.newEndTime &&
             form.value.reason.trim() &&
             isValidNewTime.value
    })
    
    // 새로운 시간 유효성 검사
    const isValidNewTime = computed(() => {
      if (!form.value.newStartTime || !form.value.newEndTime) return false
      
      const start = new Date(`2000-01-01T${form.value.newStartTime}:00`)
      const end = new Date(`2000-01-01T${form.value.newEndTime}:00`)
      
      return start < end
    })
    
    // 새로운 근무 시간 계산
    const newWorkDuration = computed(() => {
      if (!isValidNewTime.value) return '0시간'
      
      const start = new Date(`2000-01-01T${form.value.newStartTime}:00`)
      const end = new Date(`2000-01-01T${form.value.newEndTime}:00`)
      const diffMs = end - start
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      
      if (diffMinutes === 0) {
        return `${diffHours}시간`
      }
      return `${diffHours}시간 ${diffMinutes}분`
    })
    
    
    const handleSubmit = async () => {
      if (!isFormValid.value) {
        error.value = '모든 필수 항목을 올바르게 입력해주세요'
        return
      }
      
      loading.value = true
      error.value = ''
      
      try {
        const shiftStartDate = new Date(props.shift.startAt)
        const shiftDate = `${shiftStartDate.getFullYear()}-${String(shiftStartDate.getMonth() + 1).padStart(2, '0')}-${String(shiftStartDate.getDate()).padStart(2, '0')}`
        const newStartDateTime = new Date(`${shiftDate}T${form.value.newStartTime}:00`)
        const newEndDateTime = new Date(`${shiftDate}T${form.value.newEndTime}:00`)

        const shiftData = {
          startAt: newStartDateTime.toISOString(),
          endAt: newEndDateTime.toISOString(),
          memo: form.value.reason.trim()
        }

        // Call the API directly
        const response = await workshiftStore.updateWorkshift(props.shift.id, shiftData)

        // Store success data and show success modal
        successData.value = response
        showSuccessModal.value = true
      } catch (err) {
        error.value = err.message || '변경 요청 중 오류가 발생했습니다'
      } finally {
        loading.value = false
      }
    }
    
    const handleBackdropClick = () => {
      emit('close')
    }

    const handleSuccessModalClose = () => {
      showSuccessModal.value = false
      successData.value = null
      emit('update', { success: true })
      emit('close')
    }
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    }
    
    const formatShiftTime = (startAt, endAt) => {
      const start = new Date(startAt)
      const end = new Date(endAt)
      
      const formatTime = (date) => {
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      }
      
      return `${formatTime(start)} - ${formatTime(end)}`
    }
    
    const getShiftDuration = (startAt, endAt) => {
      const start = new Date(startAt)
      const end = new Date(endAt)
      const diffMs = end - start
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      
      if (diffMinutes === 0) {
        return `${diffHours}시간`
      }
      return `${diffHours}시간 ${diffMinutes}분`
    }
    
    // 초기 데이터 설정
    const initializeForm = () => {
      if (props.shift) {
        const startDate = new Date(props.shift.startAt)
        const endDate = new Date(props.shift.endAt)
        
        form.value.newStartTime = startDate.toTimeString().slice(0, 5)
        form.value.newEndTime = endDate.toTimeString().slice(0, 5)
      }
    }
    
    onMounted(() => {
      initializeForm()
    })
    
    return {
      loading,
      error,
      form,
      isFormValid,
      isValidNewTime,
      newWorkDuration,
      showSuccessModal,
      successData,
      handleSubmit,
      handleBackdropClick,
      handleSuccessModalClose,
      formatDate,
      formatShiftTime,
      getShiftDuration
    }
  }
}
</script>

<style scoped src="@/assets/styles/employee/EmployeeWorkshiftEditModal.css"></style>
