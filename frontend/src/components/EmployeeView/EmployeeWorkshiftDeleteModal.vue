<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="trash-2" :size="18" class="inline-block mr-2" />
          근무 일정 취소 요청
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
            취소할 일정
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
          <!-- 확인 메시지 -->
          <div class="danger-message">
            <div class="danger-icon">
              <AppIcon name="alert-triangle" :size="16" />
            </div>
            <div class="danger-content">
              <p><strong>정말로 이 근무 일정을 취소하시겠습니까?</strong></p>
              <p>취소된 일정은 관리자 승인 후 복구할 수 없습니다.</p>
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
            <button type="submit" class="btn btn-danger">
              <span v-if="loading">요청 중...</span>
              <span v-else>삭제</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'

export default {
  name: 'EmployeeWorkshiftDeleteModal',
  props: {
    shift: {
      type: Object,
      required: true
    }
  },
  emits: ['delete', 'close'],
  setup(props, { emit }) {
    const workshiftStore = useWorkshiftStore()
    const loading = ref(false)
    const error = ref('')

    const handleSubmit = async () => {
      loading.value = true
      error.value = ''

      try {
        // Get shopId from localStorage (user data)
        const user = JSON.parse(localStorage.getItem('user'))
        const shopId = user ? user.shopId : null

        if (!shopId) {
          throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
        }

        // Call deleteWorkshift function directly
        await workshiftStore.deleteWorkshift(parseInt(shopId), props.shift.id)

        // Emit success to parent component
        emit('delete', { success: true, shiftId: props.shift.id })
      } catch (err) {
        error.value = err.message || '근무 일정 삭제에 실패했습니다'
        console.error('Failed to delete workshift:', err)
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

    return {
      loading,
      error,
      handleSubmit,
      handleBackdropClick,
      formatDate,
      formatShiftTime,
      getShiftDuration
    }
  }
}
</script>

<style scoped src="@/assets/styles/components/EmployeeView/EmployeeWorkshiftDeleteModal.css"></style>