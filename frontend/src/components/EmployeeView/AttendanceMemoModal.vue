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
import AppIcon from '@/components/common/AppIcon.vue'

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

<style scoped src="@/assets/styles/components/EmployeeView/AttendanceMemoModal.css"></style>
