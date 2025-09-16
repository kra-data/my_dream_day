<template>
  <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header" :class="headerClass">
        <h3>
          <AppIcon :name="iconName" :size="18" class="inline-block mr-2" />
          {{ title }}
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 성공 결과 -->
        <div v-if="type === 'success'" class="result-section success">
          <div class="result-icon">
            <AppIcon name="check-circle" :size="48" />
          </div>

          <div class="result-message">
            <h4>{{ resultData.message || '출근이 완료되었습니다!' }}</h4>
            <p>출근 처리가 성공적으로 완료되었습니다.</p>
          </div>

          <div v-if="resultData.clockInAt" class="result-details">
            <div class="detail-item">
              <span class="detail-label">출근 시간:</span>
              <span class="detail-value">{{ formatTime(resultData.clockInAt) }}</span>
            </div>
            <div v-if="resultData.shiftId" class="detail-item">
              <span class="detail-label">근무 ID:</span>
              <span class="detail-value">#{{ resultData.shiftId }}</span>
            </div>
          </div>
        </div>

        <!-- 실패 결과 -->
        <div v-else-if="type === 'error'" class="result-section error">
          <div class="result-icon">
            <AppIcon name="alert-circle" :size="48" />
          </div>

          <div class="result-message">
            <h4>출근 처리 실패</h4>
            <p>{{ errorMessage || '출근 처리 중 오류가 발생했습니다.' }}</p>
          </div>

          <div v-if="errorDetails" class="error-details">
            <details>
              <summary>자세한 오류 정보</summary>
              <pre>{{ errorDetails }}</pre>
            </details>
          </div>
        </div>

        <!-- 정보 메시지 -->
        <div v-else-if="type === 'info'" class="result-section info">
          <div class="result-icon">
            <AppIcon name="info" :size="48" />
          </div>

          <div class="result-message">
            <h4>{{ title }}</h4>
            <p>{{ message || '처리가 완료되었습니다.' }}</p>
          </div>
        </div>

        <!-- 버튼 -->
        <div class="modal-actions">
          <button @click="$emit('close')" class="btn" :class="buttonClass">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'AttendanceResultModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['success', 'error', 'info'].includes(value)
    },
    title: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      default: ''
    },
    resultData: {
      type: Object,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    errorDetails: {
      type: String,
      default: null
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    // 타입에 따른 스타일 클래스
    const headerClass = computed(() => {
      return {
        'success-header': props.type === 'success',
        'error-header': props.type === 'error',
        'info-header': props.type === 'info'
      }
    })

    const buttonClass = computed(() => {
      return {
        'btn-success': props.type === 'success',
        'btn-danger': props.type === 'error',
        'btn-primary': props.type === 'info'
      }
    })

    // 아이콘 이름
    const iconName = computed(() => {
      switch (props.type) {
        case 'success': return 'check-circle'
        case 'error': return 'alert-circle'
        case 'info': return 'info'
        default: return 'info'
      }
    })

    // 배경 클릭 처리
    const handleBackdropClick = () => {
      emit('close')
    }

    // 시간 포맷팅
    const formatTime = (dateTime) => {
      if (!dateTime) return ''
      const date = new Date(dateTime)
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    }

    return {
      headerClass,
      buttonClass,
      iconName,
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
  font-size: 1.2rem;
  font-weight: 600;
}

.success-header {
  background: #f0fdf4;
  border-bottom-color: #bbf7d0;
}

.success-header h3 {
  color: #166534;
}

.error-header {
  background: #fef2f2;
  border-bottom-color: #fecaca;
}

.error-header h3 {
  color: #dc2626;
}

.info-header {
  background: #f0f9ff;
  border-bottom-color: #bfdbfe;
}

.info-header h3 {
  color: #1d4ed8;
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
  padding: 24px;
}

.result-section {
  text-align: center;
  padding: 20px 0;
}

.result-icon {
  margin-bottom: 20px;
}

.success .result-icon {
  color: #10b981;
}

.error .result-icon {
  color: #ef4444;
}

.info .result-icon {
  color: #3b82f6;
}

.result-message h4 {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
}

.result-message p {
  margin: 0 0 20px 0;
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
}

.result-details {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  text-align: left;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.detail-value {
  font-weight: 600;
  color: #1f2937;
  font-family: monospace;
  font-size: 0.95rem;
}

.error-details {
  text-align: left;
  margin-top: 16px;
}

.error-details details {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 12px;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.error-details pre {
  margin: 8px 0 0 0;
  font-size: 0.8rem;
  color: #6b7280;
  white-space: pre-wrap;
  word-break: break-word;
}

.modal-actions {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 12px 32px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 0.95rem;
  min-width: 120px;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover {
  background: #059669;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 20px;
  }

  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .detail-value {
    font-size: 0.9rem;
  }
}
</style>