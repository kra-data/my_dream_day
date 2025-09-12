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
          <!-- 변경 요청 사항 -->
          <div class="form-group">
            <label for="changeType">변경 유형 *</label>
            <select
              id="changeType"
              v-model="form.changeType"
              required
              class="form-control"
            >
              <option value="">변경 유형을 선택하세요</option>
              <option value="time">시간 변경</option>
              <option value="cancel">일정 취소</option>
            </select>
          </div>

          <!-- 시간 변경인 경우 -->
          <template v-if="form.changeType === 'time'">
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
          </template>

          <!-- 변경 사유 -->
          <div class="form-group">
            <label for="reason">변경 사유 *</label>
            <textarea
              id="reason"
              v-model="form.reason"
              required
              class="form-control"
              rows="3"
              placeholder="변경 사유를 상세히 작성해주세요 (관리자 승인에 참고됩니다)"
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
                <li>승인까지 기존 일정이 유지됩니다</li>
                <li>근무 시작 전까지만 변경 요청이 가능합니다</li>
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
</template>

<script>
import { ref, computed, onMounted } from 'vue'

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
    const loading = ref(false)
    const error = ref('')
    
    const form = ref({
      changeType: '',
      newStartTime: '',
      newEndTime: '',
      reason: ''
    })
    
    // 폼 유효성 검사
    const isFormValid = computed(() => {
      if (!form.value.changeType || !form.value.reason.trim()) return false
      
      if (form.value.changeType === 'time') {
        return form.value.newStartTime && 
               form.value.newEndTime && 
               isValidNewTime.value
      }
      
      return true
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
        let requestData = {
          changeType: form.value.changeType,
          reason: form.value.reason.trim(),
          originalShift: props.shift
        }
        
        if (form.value.changeType === 'time') {
          const shiftStartDate = new Date(props.shift.startAt)
          const shiftDate = `${shiftStartDate.getFullYear()}-${String(shiftStartDate.getMonth() + 1).padStart(2, '0')}-${String(shiftStartDate.getDate()).padStart(2, '0')}`
          const newStartDateTime = new Date(`${shiftDate}T${form.value.newStartTime}:00`)
          const newEndDateTime = new Date(`${shiftDate}T${form.value.newEndTime}:00`)
          
          requestData = {
            ...requestData,
            newStartAt: newStartDateTime.toISOString(),
            newEndAt: newEndDateTime.toISOString()
          }
        }
        
        emit('update', requestData)
      } catch (err) {
        error.value = err.message || '변경 요청 중 오류가 발생했습니다'
      } finally {
        loading.value = false
      }
    }
    
    const handleBackdropClick = () => {
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
      handleSubmit,
      handleBackdropClick,
      formatDate,
      formatShiftTime,
      getShiftDuration
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
  max-width: 500px;
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
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 20px 24px 24px;
}

.current-shift-info {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.current-shift-info h4 {
  margin: 0 0 12px 0;
  color: #1f2937;
  font-size: 1rem;
}

.shift-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.detail-label {
  color: #6b7280;
  font-weight: 500;
  font-size: 0.9rem;
}

.detail-value {
  color: #1f2937;
  font-weight: 600;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-preview {
  padding: 14px;
  background: #f0f9ff;
  border-radius: 6px;
  border: 1px solid #bfdbfe;
  margin-bottom: 18px;
}

.time-preview h5 {
  margin: 0 0 12px 0;
  color: #1f2937;
  font-size: 0.95rem;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.preview-item:last-child {
  margin-bottom: 0;
}

.preview-label {
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
}

.preview-value {
  color: #1f2937;
  font-weight: 600;
  font-size: 0.9rem;
}

.warning-message {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #fef3c7;
  border-radius: 6px;
  border: 1px solid #fcd34d;
  margin-bottom: 18px;
}

.warning-icon {
  font-size: 1.2rem;
  margin-top: 2px;
}

.warning-content {
  flex: 1;
}

.warning-content p {
  margin: 0 0 8px 0;
  color: #92400e;
  font-weight: 600;
  font-size: 0.9rem;
}

.warning-content ul {
  margin: 0;
  padding-left: 18px;
  color: #78350f;
}

.warning-content li {
  margin-bottom: 4px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.error-message {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 18px;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 20px;
  }
  
  .modal-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
  
  .shift-details {
    gap: 6px;
  }
  
  .detail-item {
    flex-direction: column;
    gap: 2px;
  }
}
</style>