<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>➕ 근무 일정 등록</h3>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <!-- 날짜 -->
          <div class="form-group">
            <label for="date">근무 날짜 *</label>
            <input
              id="date"
              v-model="form.date"
              type="date"
              required
              class="form-control"
              :min="today"
            >
          </div>

          <!-- 시작 시간 -->
          <div class="form-group">
            <label for="startTime">시작 시간 *</label>
            <input
              id="startTime"
              v-model="form.startTime"
              type="time"
              required
              class="form-control"
            >
          </div>

          <!-- 종료 시간 -->
          <div class="form-group">
            <label for="endTime">종료 시간 *</label>
            <input
              id="endTime"
              v-model="form.endTime"
              type="time"
              required
              class="form-control"
            >
          </div>

          <!-- 근무 시간 미리보기 -->
          <div v-if="isValidTime" class="time-preview">
            <div class="preview-item">
              <span class="preview-label">근무 시간:</span>
              <span class="preview-value">{{ workDuration }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">휴게 시간:</span>
              <span class="preview-value">{{ breakTime }}</span>
            </div>
          </div>

          <!-- 안내 메시지 -->
          <div class="info-message">
            <div class="info-icon">ℹ️</div>
            <div class="info-content">
              <p><strong>근무 일정 등록 안내</strong></p>
              <ul>
                <li>등록한 일정은 관리자 승인 후 확정됩니다</li>
                <li>4시간 이상 근무시 30분, 8시간 이상 근무시 1시간 휴게시간이 포함됩니다</li>
                <li>급여는 실제 근무시간을 기준으로 계산됩니다</li>
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
            <button type="submit" :disabled="!isFormValid || loading" class="btn btn-primary">
              <span v-if="loading">등록 중...</span>
              <span v-else>등록</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'

export default {
  name: 'EmployeeWorkshiftCreateModal',
  props: {
    selectedDate: {
      type: Date,
      default: null
    }
  },
  emits: ['create', 'close'],
  setup(props, { emit }) {
    const loading = ref(false)
    const error = ref('')
    
    const form = ref({
      date: '',
      startTime: '09:00',
      endTime: '18:00'
    })
    
    // 오늘 날짜 (과거 날짜 선택 방지용)
    const today = computed(() => {
      const today = new Date()
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    })
    
    // 폼 유효성 검사
    const isFormValid = computed(() => {
      return form.value.date && 
             form.value.startTime && 
             form.value.endTime &&
             isValidTime.value &&
             isValidDate.value
    })
    
    // 날짜 유효성 검사
    const isValidDate = computed(() => {
      if (!form.value.date) return false
      const selectedDate = new Date(form.value.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return selectedDate >= today
    })
    
    // 시간 유효성 검사
    const isValidTime = computed(() => {
      if (!form.value.startTime || !form.value.endTime) return false
      
      const start = new Date(`2000-01-01T${form.value.startTime}:00`)
      const end = new Date(`2000-01-01T${form.value.endTime}:00`)
      
      return start < end
    })
    
    // 근무 시간 계산
    const workDuration = computed(() => {
      if (!isValidTime.value) return '0시간'
      
      const start = new Date(`2000-01-01T${form.value.startTime}:00`)
      const end = new Date(`2000-01-01T${form.value.endTime}:00`)
      const diffMs = end - start
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      
      if (diffMinutes === 0) {
        return `${diffHours}시간`
      }
      return `${diffHours}시간 ${diffMinutes}분`
    })
    
    // 휴게 시간 계산
    const breakTime = computed(() => {
      if (!isValidTime.value) return '0분'
      
      const start = new Date(`2000-01-01T${form.value.startTime}:00`)
      const end = new Date(`2000-01-01T${form.value.endTime}:00`)
      const diffMs = end - start
      const diffHours = diffMs / (1000 * 60 * 60)
      
      if (diffHours >= 8) {
        return '1시간'
      } else if (diffHours >= 4) {
        return '30분'
      } else {
        return '해당없음'
      }
    })
    
    const handleSubmit = async () => {
      if (!isFormValid.value) {
        error.value = '모든 필수 항목을 올바르게 입력해주세요'
        return
      }
      
      loading.value = true
      error.value = ''
      
      try {
        // ISO 8601 형식으로 날짜 시간 생성
        const startDateTime = new Date(`${form.value.date}T${form.value.startTime}:00`)
        const endDateTime = new Date(`${form.value.date}T${form.value.endTime}:00`)
        
        const shiftData = {
          startAt: startDateTime.toISOString(),
          endAt: endDateTime.toISOString()
        }
        
        emit('create', shiftData)
      } catch (err) {
        error.value = err.message || '일정 등록 중 오류가 발생했습니다'
      } finally {
        loading.value = false
      }
    }
    
    const handleBackdropClick = () => {
      emit('close')
    }
    
    // 선택된 날짜가 있으면 폼에 설정
    watch(() => props.selectedDate, (newDate) => {
      if (newDate) {
        const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`
        form.value.date = dateStr
        
        // 시간이 있는 경우 (시간 클릭)
        if (newDate.getHours() !== 0) {
          form.value.startTime = String(newDate.getHours()).padStart(2, '0') + ':00'
          form.value.endTime = String(Math.min(newDate.getHours() + 8, 23)).padStart(2, '0') + ':00'
        }
      }
    }, { immediate: true })
    
    onMounted(() => {
      // 기본값으로 내일 설정
      if (!form.value.date) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        form.value.date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
      }
    })
    
    return {
      loading,
      error,
      form,
      today,
      isFormValid,
      isValidDate,
      isValidTime,
      workDuration,
      breakTime,
      handleSubmit,
      handleBackdropClick
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
  max-width: 480px;
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

.info-message {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #fffbeb;
  border-radius: 6px;
  border: 1px solid #fed7aa;
  margin-bottom: 18px;
}

.info-icon {
  font-size: 1.2rem;
  margin-top: 2px;
}

.info-content {
  flex: 1;
}

.info-content p {
  margin: 0 0 8px 0;
  color: #92400e;
  font-weight: 600;
  font-size: 0.9rem;
}

.info-content ul {
  margin: 0;
  padding-left: 18px;
  color: #78350f;
}

.info-content li {
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

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
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
}
</style>