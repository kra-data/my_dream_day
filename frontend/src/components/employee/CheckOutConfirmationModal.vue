<template>
  <!-- Teleport를 사용해 body에 직접 렌더링 -->
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="clock" :size="18" class="inline-block mr-2" />
          퇴근 시간 확인
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 미리보기 정보 -->
        <div v-if="previewData" class="preview-section">
          <div class="preview-message">
            <AppIcon name="info" :size="20" class="text-orange-500" />
            <p>{{ previewData.message || '퇴근 시간을 확인해주세요' }}</p>
          </div>

          <!-- 근무 정보 -->
          <div class="shift-info-section">
            <div class="shift-info-item">
              <span class="info-label">퇴근 시간</span>
              <span class="info-value">{{ formatTime(previewData.actualInAt) }}</span>
            </div>
            <div class="shift-info-item">
              <span class="info-label">예정 퇴근 시간</span>
              <span class="info-value">{{ previewData.scheduledOutAt ? formatTime(previewData.scheduledOutAt) : '미정' }}</span>
            </div>
          </div>

          <div class="time-section">
            <div class="suggested-time">
              <span class="time-label">제안된 퇴근 시간</span>
              <span class="time-value">{{ formatTime(previewData.suggestedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- 시간 수정 -->
        <form @submit.prevent="handleConfirm">
          <div class="form-group">
            <label for="checkOutTime">퇴근 시간 *</label>
            <div class="time-input-group">
              <input
                id="checkOutTime"
                v-model="selectedTime"
                type="time"
                required
                class="form-control time-input"
              >
              <button
                type="button"
                @click="resetToSuggested"
                class="btn btn-secondary btn-sm reset-btn"
                title="제안된 시간으로 초기화"
              >
                <AppIcon name="refresh" :size="14" />
                초기화
              </button>
            </div>
          </div>

          <!-- 최종 확인 메시지 -->
          <div class="confirmation-message checkout">
            <div class="confirmation-icon">
              <AppIcon name="clock" :size="16" />
            </div>
            <div class="confirmation-content">
              <p><strong>{{ formatTime(finalDateTime) }}</strong>에 퇴근하시겠습니까?</p>
              <p class="confirmation-note">확인 후 퇴근 처리가 진행됩니다.</p>
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
            <button type="submit" :disabled="loading" class="btn btn-warning">
              <span v-if="loading">처리 중...</span>
              <span v-else>퇴근하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'CheckOutConfirmationModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    previewData: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'confirm'],
  setup(props, { emit }) {
    const selectedTime = ref('')
    const error = ref('')

    // 미리보기 데이터가 변경되면 초기 시간 설정
    watch(() => props.previewData, (newData) => {
      if (newData && newData.suggestedAt) {
        const suggestedTime = new Date(newData.suggestedAt)
        selectedTime.value = suggestedTime.toTimeString().slice(0, 5)
      }
    }, { immediate: true })

    // 최종 DateTime 계산
    const finalDateTime = computed(() => {
      if (!selectedTime.value || !props.previewData) return null

      const scannedDate = new Date(props.previewData.scannedAt)
      const [hours, minutes] = selectedTime.value.split(':')

      const finalDate = new Date(scannedDate)
      finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

      return finalDate
    })

    // 제안된 시간으로 초기화
    const resetToSuggested = () => {
      if (props.previewData && props.previewData.suggestedAt) {
        const suggestedTime = new Date(props.previewData.suggestedAt)
        selectedTime.value = suggestedTime.toTimeString().slice(0, 5)
      }
    }

    // 확인 처리
    const handleConfirm = () => {
      if (!selectedTime.value) {
        error.value = '퇴근 시간을 선택해주세요'
        return
      }

      if (!finalDateTime.value) {
        error.value = '올바른 시간을 입력해주세요'
        return
      }

      error.value = ''
      emit('confirm', finalDateTime.value.toISOString())
    }

    // 배경 클릭 처리
    const handleBackdropClick = () => {
      if (!props.loading) {
        emit('close')
      }
    }

    // 시간 포맷팅
    const formatTime = (dateTime) => {
      if (!dateTime) return ''
      const date = new Date(dateTime)
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }

    return {
      selectedTime,
      error,
      finalDateTime,
      resetToSuggested,
      handleConfirm,
      handleBackdropClick,
      formatTime
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
  z-index: 9999 !important;
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

.preview-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #fff7ed;
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

.preview-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.preview-message p {
  margin: 0;
  color: #92400e;
  font-weight: 500;
  font-size: 0.95rem;
}

.shift-info-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
}

.shift-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.shift-info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #78716c;
  font-size: 0.875rem;
  font-weight: 500;
}

.info-value {
  color: #1c1917;
  font-weight: 600;
  font-family: monospace;
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggested-time {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-label {
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
}

.time-value {
  color: #1f2937;
  font-weight: 600;
  font-size: 1.1rem;
  font-family: monospace;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.time-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.time-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  font-family: monospace;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.time-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.reset-btn {
  padding: 8px 12px;
  white-space: nowrap;
}

.confirmation-message {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f0fdf4;
  border-radius: 8px;
  border-left: 4px solid #10b981;
  margin-bottom: 20px;
}

.confirmation-message.checkout {
  background: #fff7ed;
  border-left-color: #f59e0b;
}

.confirmation-icon {
  color: #10b981;
  font-size: 1.2rem;
  margin-top: 2px;
}

.confirmation-message.checkout .confirmation-icon {
  color: #f59e0b;
}

.confirmation-content {
  flex: 1;
}

.confirmation-content p {
  margin: 0 0 4px 0;
  color: #065f46;
  font-size: 0.95rem;
}

.confirmation-message.checkout .confirmation-content p {
  color: #92400e;
}

.confirmation-content p:first-child {
  font-weight: 600;
}

.confirmation-note {
  font-size: 0.85rem;
  color: #047857;
}

.confirmation-message.checkout .confirmation-note {
  color: #a16207;
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

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.text-orange-500 {
  color: #f59e0b;
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

  .time-input-group {
    flex-direction: column;
  }

  .time-input {
    width: 100%;
  }
}
</style>