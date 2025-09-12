<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="edit" :size="18" class="inline-block mr-2" />
          근무 일정 수정
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      
      <div class="modal-body">
        <!-- 직원 정보 -->
        <div class="employee-info">
          <div class="employee-avatar">
            {{ shift.employee?.name?.charAt(0) || 'U' }}
          </div>
          <div class="employee-details">
            <h4>{{ shift.employee?.name || '이름 없음' }}</h4>
            <p>{{ formatSection(shift.employee?.section) }} · {{ formatPosition(shift.employee?.position) }}</p>
          </div>
        </div>

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

          <!-- 상태 -->
          <div class="form-group">
            <label for="status">일정 상태</label>
            <select
              id="status"
              v-model="form.status"
              class="form-control"
            >
              <option value="SCHEDULED">예정됨</option>
              <option value="IN_PROGRESS">진행중</option>
              <option value="COMPLETED">완료됨</option>
              <option value="CANCELLED">취소됨</option>
            </select>
          </div>

          <!-- 메모 -->
          <div class="form-group">
            <label for="notes">메모</label>
            <textarea
              id="notes"
              v-model="form.notes"
              class="form-control"
              rows="3"
              placeholder="근무 일정에 대한 추가 메모를 입력하세요"
            ></textarea>
          </div>

          <!-- 근무 시간 미리보기 -->
          <div v-if="isValidTime" class="time-preview">
            <div class="preview-item">
              <span class="preview-label">근무 시간:</span>
              <span class="preview-value">{{ workDuration }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">현재 상태:</span>
              <span class="preview-value">
                <StatusBadge :status="form.status" />
              </span>
            </div>
          </div>

          <!-- 변경 사항 요약 -->
          <div v-if="hasChanges" class="changes-summary">
            <h5>변경 사항</h5>
            <ul>
              <li v-if="originalData.date !== form.date">
                날짜: {{ formatDate(originalData.date) }} → {{ formatDate(form.date) }}
              </li>
              <li v-if="originalData.startTime !== form.startTime">
                시작 시간: {{ originalData.startTime }} → {{ form.startTime }}
              </li>
              <li v-if="originalData.endTime !== form.endTime">
                종료 시간: {{ originalData.endTime }} → {{ form.endTime }}
              </li>
              <li v-if="originalData.status !== form.status">
                상태: {{ formatStatus(originalData.status) }} → {{ formatStatus(form.status) }}
              </li>
            </ul>
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
            <button type="submit" :disabled="!isFormValid || !hasChanges || loading" class="btn btn-primary">
              <span v-if="loading">수정 중...</span>
              <span v-else>수정</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'

export default {
  name: 'WorkshiftEditModal',
  components: {
    StatusBadge
  },
  props: {
    shift: {
      type: Object,
      required: true
    },
    employees: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update', 'close'],
  setup(props, { emit }) {
    const loading = ref(false)
    const error = ref('')
    
    const form = ref({
      date: '',
      startTime: '',
      endTime: '',
      status: 'SCHEDULED',
      notes: ''
    })
    
    const originalData = ref({})
    
    // 폼 유효성 검사
    const isFormValid = computed(() => {
      return form.value.date && 
             form.value.startTime && 
             form.value.endTime &&
             isValidTime.value
    })
    
    // 시간 유효성 검사
    const isValidTime = computed(() => {
      if (!form.value.startTime || !form.value.endTime) return false
      
      const start = new Date(`2000-01-01T${form.value.startTime}:00`)
      const end = new Date(`2000-01-01T${form.value.endTime}:00`)
      
      return start < end
    })
    
    // 변경 사항 확인
    const hasChanges = computed(() => {
      return Object.keys(originalData.value).some(key => {
        return originalData.value[key] !== form.value[key]
      })
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
    
    
    const handleSubmit = async () => {
      if (!isFormValid.value || !hasChanges.value) {
        error.value = '변경 사항이 없거나 입력이 올바르지 않습니다'
        return
      }
      
      loading.value = true
      error.value = ''
      
      try {
        // 로칼 시간 입력을 서버로 전송 (toISOString이 자동으로 UTC 변환)
        const startDateTime = new Date(`${form.value.date}T${form.value.startTime}:00`)
        const endDateTime = new Date(`${form.value.date}T${form.value.endTime}:00`)
        
        const shiftData = {
          startAt: startDateTime.toISOString(),
          endAt: endDateTime.toISOString(),
          status: form.value.status,
          notes: form.value.notes
        }
        
        emit('update', shiftData)
      } catch (err) {
        error.value = err.message || '일정 수정 중 오류가 발생했습니다'
      } finally {
        loading.value = false
      }
    }
    
    const handleBackdropClick = () => {
      emit('close')
    }
    
    const formatSection = (section) => {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section
    }
    
    const formatPosition = (position) => {
      const positions = {
        'OWNER': '오너',
        'MANAGER': '매니저',
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position
    }
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR')
    }
    
    const formatStatus = (status) => {
      const statuses = {
        'SCHEDULED': '예정됨',
        'IN_PROGRESS': '진행중',
        'COMPLETED': '완료됨',
        'CANCELLED': '취소됨'
      }
      return statuses[status] || status
    }
    
    // 초기 데이터 설정
    const initializeForm = () => {
      if (!props.shift) return
      
      // UTC 시간을 브라우저가 자동으로 로칼시간으로 변환하여 표시
      const startDate = new Date(props.shift.startAt)
      const endDate = new Date(props.shift.endAt)
      
      const formData = {
        date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
        status: props.shift.status || 'SCHEDULED',
        notes: props.shift.notes || ''
      }
      
      form.value = { ...formData }
      originalData.value = { ...formData }
    }
    
    onMounted(() => {
      initializeForm()
    })
    
    return {
      loading,
      error,
      form,
      originalData,
      isFormValid,
      isValidTime,
      hasChanges,
      workDuration,
      handleSubmit,
      handleBackdropClick,
      formatSection,
      formatPosition,
      formatDate,
      formatStatus
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
  padding: 24px 24px 0;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 24px;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.employee-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
}

.employee-details h4 {
  margin: 0 0 4px 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.employee-details p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 20px;
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
  padding: 16px;
  background: #f0f9ff;
  border-radius: 6px;
  border: 1px solid #bfdbfe;
  margin-bottom: 20px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.preview-item:last-child {
  margin-bottom: 0;
}

.preview-label {
  color: #374151;
  font-weight: 500;
}

.preview-value {
  color: #1f2937;
  font-weight: 600;
}

.changes-summary {
  padding: 16px;
  background: #fffbeb;
  border-radius: 6px;
  border: 1px solid #fed7aa;
  margin-bottom: 20px;
}

.changes-summary h5 {
  margin: 0 0 12px 0;
  color: #92400e;
  font-size: 0.9rem;
  font-weight: 600;
}

.changes-summary ul {
  margin: 0;
  padding-left: 20px;
  color: #78350f;
}

.changes-summary li {
  margin-bottom: 4px;
  font-size: 0.9rem;
}

.error-message {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
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
  
  .employee-info {
    flex-direction: column;
    text-align: center;
  }
}
</style>