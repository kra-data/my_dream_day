<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>➕ 새 근무 일정 등록</h3>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <!-- 직원 선택 -->
          <div class="form-group">
            <label for="employee">직원 선택 *</label>
            <select
              id="employee"
              v-model="form.employeeId"
              required
              class="form-control"
            >
              <option value="">직원을 선택하세요</option>
              <option
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.name }} ({{ formatSection(employee.section) }} · {{ formatPosition(employee.position) }})
              </option>
            </select>
          </div>

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

          <!-- 반복 설정 -->
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="form.recurring"
                type="checkbox"
                class="form-checkbox"
              >
              반복 일정으로 설정
            </label>
          </div>

          <!-- 반복 옵션 -->
          <div v-if="form.recurring" class="recurring-options">
            <div class="form-group">
              <label for="recurringType">반복 주기</label>
              <select
                id="recurringType"
                v-model="form.recurringType"
                class="form-control"
              >
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
              </select>
            </div>

            <div class="form-group">
              <label for="recurringEnd">반복 종료일</label>
              <input
                id="recurringEnd"
                v-model="form.recurringEnd"
                type="date"
                class="form-control"
              >
            </div>
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
              <span class="preview-label">휴게 시간:</span>
              <span class="preview-value">{{ breakTime }}</span>
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
              <span v-if="loading">생성 중...</span>
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
  name: 'WorkshiftCreateModal',
  props: {
    employees: {
      type: Array,
      default: () => []
    },
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
      employeeId: '',
      date: '',
      startTime: '09:00',
      endTime: '18:00',
      recurring: false,
      recurringType: 'weekly',
      recurringEnd: '',
      notes: ''
    })
    
    // 폼 유효성 검사
    const isFormValid = computed(() => {
      return form.value.employeeId && 
             form.value.date && 
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
    
    // 휴게 시간 계산 (4시간 이상 근무시 30분, 8시간 이상 근무시 1시간)
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
        error.value = '모든 필수 항목을 입력해주세요'
        return
      }
      
      loading.value = true
      error.value = ''
      
      try {
        const startDateTime = new Date(`${form.value.date}T${form.value.startTime}:00`)
        const endDateTime = new Date(`${form.value.date}T${form.value.endTime}:00`)
        
        const shiftData = {
          employeeId: parseInt(form.value.employeeId),
          startAt: startDateTime.toISOString(),
          endAt: endDateTime.toISOString(),
          notes: form.value.notes
        }
        
        if (form.value.recurring) {
          // 반복 일정의 경우 여러 개의 일정을 생성
          const shifts = generateRecurringShifts(shiftData)
          for (const shift of shifts) {
            await emit('create', shift)
            // 서버 부하를 줄이기 위해 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } else {
          emit('create', shiftData)
        }
      } catch (err) {
        error.value = err.message || '일정 생성 중 오류가 발생했습니다'
      } finally {
        loading.value = false
      }
    }
    
    const generateRecurringShifts = (baseShift) => {
      const shifts = []
      const startDate = new Date(form.value.date)
      const endDate = form.value.recurringEnd ? new Date(form.value.recurringEnd) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 기본 30일
      
      const current = new Date(startDate)
      
      while (current <= endDate) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        const shiftStart = new Date(`${dateStr}T${form.value.startTime}:00`)
        const shiftEnd = new Date(`${dateStr}T${form.value.endTime}:00`)
        
        shifts.push({
          ...baseShift,
          startAt: shiftStart.toISOString(),
          endAt: shiftEnd.toISOString()
        })
        
        // 다음 반복일 계산
        switch (form.value.recurringType) {
          case 'daily':
            current.setDate(current.getDate() + 1)
            break
          case 'weekly':
            current.setDate(current.getDate() + 7)
            break
          case 'monthly':
            current.setMonth(current.getMonth() + 1)
            break
        }
      }
      
      return shifts
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
    
    // 선택된 날짜가 있으면 폼에 설정
    watch(() => props.selectedDate, (newDate) => {
      if (newDate) {
        const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`
        form.value.date = dateStr
        
        // 시간이 있는 경우 (주간 뷰에서 시간 클릭)
        if (newDate.getHours() !== 0) {
          form.value.startTime = String(newDate.getHours()).padStart(2, '0') + ':00'
          form.value.endTime = String(Math.min(newDate.getHours() + 8, 23)).padStart(2, '0') + ':00'
        }
      }
    }, { immediate: true })
    
    onMounted(() => {
      // 오늘 날짜가 기본값이 아닌 경우에만 설정
      if (!form.value.date) {
        const today = new Date()
        form.value.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      }
    })
    
    return {
      loading,
      error,
      form,
      isFormValid,
      isValidTime,
      workDuration,
      breakTime,
      handleSubmit,
      handleBackdropClick,
      formatSection,
      formatPosition
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

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 0 !important;
}

.form-checkbox {
  width: auto !important;
  margin: 0 !important;
}

.recurring-options {
  margin-left: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
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
}
</style>