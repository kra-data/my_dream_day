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
<style scoped src="@/assets/styles/components/EmployeeView/AttendanceResultModal.css"></style>
