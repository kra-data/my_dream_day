<template>
  <!-- 디버깅용 로그 -->
  {{ console.log('CheckInConfirmationModal template rendering, show:', show, 'previewData:', previewData) }}

  <!-- Teleport를 사용해 body에 직접 렌더링 -->
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="clock" :size="18" class="inline-block mr-2" />
          출근 시간 확인
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 미리보기 정보 -->
        <div v-if="previewData" class="preview-section">
          <div class="preview-message">
            <AppIcon name="info" :size="20" class="text-blue-500" />
            <p>{{ previewData.message || '출근 시간을 확인해주세요' }}</p>
          </div>

          <div class="time-section">
            <div class="suggested-time">
              <span class="time-label">제안된 출근 시간</span>
              <span class="time-value">{{ formatTime(previewData.suggestedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- 시간 수정 -->
        <form @submit.prevent="handleConfirm">
          <div class="form-group">
            <label for="checkInTime">출근 시간 *</label>
            <div class="time-input-group">
              <input
                id="checkInTime"
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
          <div class="confirmation-message">
            <div class="confirmation-icon">
              <AppIcon name="clock" :size="16" />
            </div>
            <div class="confirmation-content">
              <p><strong>{{ formatTime(finalDateTime) }}</strong>에 출근하시겠습니까?</p>
              <p class="confirmation-note">확인 후 출근 처리가 진행됩니다.</p>
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
            <button type="submit" :disabled="loading" class="btn btn-primary">
              <span v-if="loading">처리 중...</span>
              <span v-else>출근하기</span>
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
  name: 'CheckInConfirmationModal',
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

    // 디버깅용 로그
    watch(() => props.show, (newVal, oldVal) => {
      console.log('CheckInConfirmationModal show prop changed:', oldVal, '->', newVal)
      if (newVal) {
        console.log('Modal should be visible now!')
        console.log('Preview data:', props.previewData)
      }
    }, { immediate: true })

    watch(() => props.previewData, (newVal) => {
      console.log('CheckInConfirmationModal previewData changed:', newVal)
    })

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
        error.value = '출근 시간을 선택해주세요'
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

<style scoped src="@/assets/styles/components/EmployeeView/CheckInConfirmationModal.css"></style>