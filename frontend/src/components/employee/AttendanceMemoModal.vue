<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="message-square" :size="18" class="inline-block mr-2" />
          {{ isCheckIn ? '출근' : '퇴근' }} 메모 작성
        </h3>
        <button @click="handleClose" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      
      <div class="modal-body">
        <!-- 이상 상황 안내 -->
        <div class="irregularity-info">
          <div class="info-icon">
            <AppIcon name="alert-triangle" :size="20" />
          </div>
          <div class="info-content">
            <h4>근무 시간 이상 감지</h4>
            <p>{{ irregularityMessage }}</p>
            <p class="info-detail">관리자에게 상황을 설명하는 메모를 남겨주세요.</p>
          </div>
        </div>

        <!-- 메모 작성 폼 -->
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="memo">메모 *</label>
            <textarea
              id="memo"
              v-model="memo"
              required
              class="form-control"
              rows="4"
              :placeholder="memoPlaceholder"
              maxlength="200"
            ></textarea>
            <div class="char-count">
              {{ memo.length }}/200
            </div>
          </div>

          <!-- 버튼들 -->
          <div class="modal-actions">
            <button type="button" @click="handleSkip" class="btn btn-secondary">
              메모 없이 진행
            </button>
            <button type="submit" :disabled="!memo.trim() || loading" class="btn btn-primary">
              <span v-if="loading">처리 중...</span>
              <span v-else>{{ isCheckIn ? '출근' : '퇴근' }} 완료</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'AttendanceMemoModal',
  components: {
    AppIcon
  },
  props: {
    isCheckIn: {
      type: Boolean,
      required: true
    },
    irregularityType: {
      type: String,
      required: true,
      validator: value => ['late_checkin', 'early_checkout', 'overtime'].includes(value)
    },
    timeDifference: {
      type: Number,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['proceed-with-memo', 'proceed-without-memo', 'cancel'],
  setup(props, { emit }) {
    const memo = ref('')

    const irregularityMessage = computed(() => {
      switch (props.irregularityType) {
        case 'late_checkin':
          return `예정 시간보다 ${props.timeDifference}분 늦은 출근입니다.`
        case 'early_checkout':
          return `예정 시간보다 ${props.timeDifference}분 빠른 퇴근입니다.`
        case 'overtime':
          return `예정 시간보다 ${props.timeDifference}분 초과 근무입니다.`
        default:
          return '근무 시간에 이상이 감지되었습니다.'
      }
    })

    const memoPlaceholder = computed(() => {
      switch (props.irregularityType) {
        case 'late_checkin':
          return '지각 사유를 입력해주세요 (예: 교통 체증, 컨디션 난조 등)'
        case 'early_checkout':
          return '조퇴 사유를 입력해주세요 (예: 컨디션 저하, 개인 사정 등)'
        case 'overtime':
          return '초과 근무 사유를 입력해주세요 (예: 업무 마무리, 고객 응대 등)'
        default:
          return '상황에 대해 설명해주세요'
      }
    })

    const handleSubmit = () => {
      if (memo.value.trim()) {
        emit('proceed-with-memo', memo.value.trim())
      }
    }

    const handleSkip = () => {
      emit('proceed-without-memo')
    }

    const handleClose = () => {
      emit('cancel')
    }

    const handleBackdropClick = () => {
      emit('cancel')
    }

    return {
      memo,
      irregularityMessage,
      memoPlaceholder,
      handleSubmit,
      handleSkip,
      handleClose,
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 4px;
  line-height: 1;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
}

.modal-body {
  padding: 20px 24px 24px;
}

.irregularity-info {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--warning-50);
  border: 1px solid var(--warning-200);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
}

.info-icon {
  color: var(--warning-600);
  margin-top: 2px;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
}

.info-content h4 {
  margin: 0 0 4px 0;
  color: var(--warning-800);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.info-content p {
  margin: 0 0 4px 0;
  color: var(--warning-700);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.info-detail {
  color: var(--warning-600) !important;
  font-size: var(--text-xs) !important;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.form-control {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: inherit;
  transition: all 0.2s ease;
  resize: vertical;
  min-height: 100px;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.char-count {
  text-align: right;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light);
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-700);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
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
    min-width: auto;
  }
}
</style>