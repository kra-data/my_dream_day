<template>
  <div class="modal-backdrop" @click="handleClose">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="plus" :size="18" class="inline-block mr-2" />
          근무 일정 등록
        </h3>
        <button @click="handleClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
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
          </div>

          <!-- 안내 메시지 -->
          <div class="info-message">
            <div class="info-icon">
              <AppIcon name="info" :size="16" />
            </div>
            <div class="info-content">
              <p><strong>근무 일정 등록 안내</strong></p>
              <ul>
                <li>등록한 일정은 수정 및 삭제 가능합니다.</li>
                <li>급여는 실제 근무시간을 기준으로 계산됩니다</li>
              </ul>
            </div>
          </div>

          <!-- 에러 메시지 -->
          <div v-if="displayError" class="error-message">
            <div class="error-icon">
              <AppIcon name="alert-triangle" :size="16" />
            </div>
            <div class="error-content">
              <strong>일정 등록 실패</strong>
              <p>{{ displayError }}</p>
            </div>
          </div>

          <!-- 버튼들 -->
          <div class="modal-actions">
            <button type="button" @click="handleClose" class="btn btn-secondary">
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
    },
    storeError: {
      type: String,
      default: ''
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
    
    // 표시할 에러 메시지 (로컬 에러 또는 스토어 에러)
    const displayError = computed(() => {
      return error.value || props.storeError
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
    
    // 모달이 닫힐 때 에러 초기화
    const handleClose = () => {
      error.value = ''
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
      // 기본값으로 오늘 설정
      if (!form.value.date) {
          const today = new Date()
          form.value.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
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
      displayError,
      handleSubmit,
      handleBackdropClick,
      handleClose
    }
  }
}
</script>

<style scoped src="@/assets/styles/components/EmployeeView/EmployeeWorkshiftCreateModal.css"></style>
