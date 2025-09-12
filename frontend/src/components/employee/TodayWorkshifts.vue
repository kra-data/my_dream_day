<template>
  <div class="today-workshifts card">
    <div class="section-header">
      <h3><AppIcon name="calendar" :size="20" class="mr-2" />오늘의 근무</h3>
      <span class="date-text">{{ formatDate(new Date()) }}</span>
    </div>

    <!-- 로딩 상태 -->
    <div v-if="attendanceStore.loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>근무 일정을 불러오는 중...</p>
    </div>

    <!-- 에러 상태 -->
    <div v-else-if="attendanceStore.error" class="error-container">
      <div class="error-message">
        <AppIcon name="alert-triangle" :size="20" class="mr-2" />
        <span>{{ attendanceStore.error }}</span>
      </div>
      <button @click="refreshWorkshifts" class="btn btn-sm btn-outline">
        <AppIcon name="refresh" :size="16" class="mr-1" />
        다시 시도
      </button>
    </div>

    <!-- 근무 일정이 없는 경우 -->
    <div v-else-if="todayShifts.length === 0" class="no-shifts">
      <div class="no-shifts-content">
        <AppIcon name="calendar-x" :size="48" class="opacity-50" />
        <h4>오늘 예정된 근무가 없습니다</h4>
        <p>출근하시려면 먼저 근무 일정을 생성해야 합니다.</p>
        <button 
          @click="showCreateShiftModal = true" 
          class="btn btn-primary btn-base"
        >
          <AppIcon name="plus" :size="16" class="mr-1" />
          근무 생성하기
        </button>
      </div>
    </div>

    <!-- 오늘의 근무 일정 목록 -->
    <div v-else class="shifts-list">
      <div 
        v-for="shift in todayShifts" 
        :key="shift.id"
        class="shift-card"
        :class="{ 
          'shift-active': isShiftActive(shift),
          'shift-completed': isShiftCompleted(shift),
          'shift-upcoming': isShiftUpcoming(shift)
        }"
      >
        <!-- 근무 시간 정보 -->
        <div class="shift-info">
          <div class="shift-time">
            <AppIcon name="clock" :size="16" class="mr-1" />
            <span class="time-range">{{ formatShiftTime(shift.startAt, shift.endAt) }}</span>
            <span class="duration">({{ getShiftDuration(shift.startAt, shift.endAt) }})</span>
          </div>
          <div class="shift-status">
            <StatusBadge :status="getShiftStatusBadge(shift)" />
          </div>
        </div>

        <!-- 실제 출퇴근 시간 -->
        <div v-if="shift.actualInAt || shift.actualOutAt" class="actual-times">
          <div v-if="shift.actualInAt" class="actual-time">
            <AppIcon name="arrow-right" :size="14" class="mr-1 text-success" />
            <span class="label">실제 출근:</span>
            <span class="time">{{ formatTime(shift.actualInAt) }}</span>
          </div>
          <div v-if="shift.actualOutAt" class="actual-time">
            <AppIcon name="arrow-left" :size="14" class="mr-1 text-warning" />
            <span class="label">실제 퇴근:</span>
            <span class="time">{{ formatTime(shift.actualOutAt) }}</span>
          </div>
        </div>

        <!-- 출퇴근 버튼 -->
        <div class="shift-actions">
          <!-- 출근 버튼 -->
          <button 
            v-if="canCheckInToShift(shift)"
            @click="checkInToShift(shift)"
            class="btn btn-success btn-sm"
            :class="{ 'btn-loading': attendanceLoading }"
            :disabled="attendanceLoading"
          >
            <span v-if="!attendanceLoading">
              <AppIcon name="arrow-right" :size="16" class="mr-1" />
              출근하기
            </span>
            <span v-else>출근 처리 중...</span>
          </button>

          <!-- 퇴근 버튼 -->
          <button 
            v-if="canCheckOutFromShift(shift)"
            @click="checkOutFromShift(shift)"
            class="btn btn-warning btn-sm"
            :class="{ 'btn-loading': attendanceLoading }"
            :disabled="attendanceLoading"
          >
            <span v-if="!attendanceLoading">
              <AppIcon name="arrow-left" :size="16" class="mr-1" />
              퇴근하기
            </span>
            <span v-else>퇴근 처리 중...</span>
          </button>

          <!-- 완료된 근무 -->
          <div v-if="isShiftCompleted(shift)" class="completed-badge">
            <AppIcon name="check" :size="16" class="mr-1" />
            <span>근무 완료</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 근무 생성 모달 -->
    <EmployeeWorkshiftCreateModal 
      v-if="showCreateShiftModal"
      @close="showCreateShiftModal = false"
      @create="handleShiftCreated"
    />

    <!-- 메모 작성 모달 -->
    <AttendanceMemoModal
      v-if="showMemoModal"
      :is-check-in="memoModalData.isCheckIn"
      :irregularity-type="memoModalData.irregularityType"
      :time-difference="memoModalData.timeDifference"
      :loading="attendanceLoading"
      @proceed-with-memo="handleProceedWithMemo"
      @proceed-without-memo="handleProceedWithoutMemo"
      @cancel="handleCancelMemo"
    />
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import EmployeeWorkshiftCreateModal from '@/components/employee/EmployeeWorkshiftCreateModal.vue'
import AttendanceMemoModal from '@/components/employee/AttendanceMemoModal.vue'
import { useWorkshiftStore } from '@/stores/workshift'

export default {
  name: 'TodayWorkshifts',
  components: {
    AppIcon,
    StatusBadge,
    EmployeeWorkshiftCreateModal,
    AttendanceMemoModal
  },
  props: {
    attendanceStore: {
      type: Object,
      required: true
    },
    attendanceLoading: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const workshiftStore = useWorkshiftStore()
    const showCreateShiftModal = ref(false)
    const showMemoModal = ref(false)
    const memoModalData = ref({
      shift: null,
      isCheckIn: true,
      irregularityType: '',
      timeDifference: 0
    })

    // 오늘의 근무 일정 필터링 - Use workshift store filtering
    const todayShifts = computed(() => {
      return workshiftStore.getTodayWorkshifts()
    })

    // 근무 상태 확인 함수들 (status 필드 기반)
    const isShiftActive = (shift) => {
      return shift.status === 'IN_PROGRESS'
    }

    const isShiftCompleted = (shift) => {
      return shift.status === 'COMPLETED'
    }

    const isShiftUpcoming = (shift) => {
      return shift.status === 'SCHEDULED'
    }

    // 출퇴근 가능 여부 확인 (status 필드 기반)
    const canCheckInToShift = (shift) => {
      return shift.status === 'SCHEDULED'
    }

    const canCheckOutFromShift = (shift) => {
      return shift.status === 'IN_PROGRESS'
    }

    // 근무 상태 배지 결정 (status 필드 기반)
    const getShiftStatusBadge = (shift) => {
      const backendStatus = shift.status || 'SCHEDULED'
      return backendStatus.toLowerCase()
    }

    // 출퇴근 이상 상황 감지
    const detectIrregularity = (shift, isCheckIn) => {
      const now = new Date()
      const shiftStart = new Date(shift.startAt)
      const shiftEnd = new Date(shift.endAt)
      
      if (isCheckIn) {
        // 출근 시 지각 검사 (10분 이상 늦음)
        const lateDiffMs = now.getTime() - shiftStart.getTime()
        const lateMinutes = Math.floor(lateDiffMs / (1000 * 60))
        
        if (lateMinutes >= 10) {
          return {
            hasIrregularity: true,
            type: 'late_checkin',
            timeDifference: lateMinutes
          }
        }
      } else {
        // 퇴근 시 조퇴/초과근무 검사
        const diffMs = now.getTime() - shiftEnd.getTime()
        const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60))
        
        if (diffMs < -10 * 60 * 1000) {
          // 10분 이상 빠른 퇴근 (조퇴)
          return {
            hasIrregularity: true,
            type: 'early_checkout',
            timeDifference: diffMinutes
          }
        } else if (diffMs > 10 * 60 * 1000) {
          // 10분 이상 늦은 퇴근 (초과근무)
          return {
            hasIrregularity: true,
            type: 'overtime',
            timeDifference: diffMinutes
          }
        }
      }
      
      return { hasIrregularity: false }
    }

    // 시간 포맷팅 함수들 (한국시간 기준)
    const formatDate = (date) => {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return '-'
      return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    const formatShiftTime = (startAt, endAt) => {
      return workshiftStore.formatShiftTime(startAt, endAt)
    }

    const getShiftDuration = (startAt, endAt) => {
      return workshiftStore.getShiftDuration(startAt, endAt)
    }

    // 출퇴근 처리 함수들
    const checkInToShift = async (shift) => {
      // 이상 상황 감지
      const irregularity = detectIrregularity(shift, true)
      
      if (irregularity.hasIrregularity) {
        // 메모 모달 표시
        memoModalData.value = {
          shift,
          isCheckIn: true,
          irregularityType: irregularity.type,
          timeDifference: irregularity.timeDifference
        }
        showMemoModal.value = true
        return
      }
      
      // 정상 출근 처리
      await processAttendance(shift, true)
    }

    const checkOutFromShift = async (shift) => {
      // 이상 상황 감지
      const irregularity = detectIrregularity(shift, false)
      
      if (irregularity.hasIrregularity) {
        // 메모 모달 표시
        memoModalData.value = {
          shift,
          isCheckIn: false,
          irregularityType: irregularity.type,
          timeDifference: irregularity.timeDifference
        }
        showMemoModal.value = true
        return
      }
      
      // 정상 퇴근 처리
      await processAttendance(shift, false)
    }

    // 실제 출퇴근 처리 함수
    const processAttendance = async (shift, isCheckIn, memo = null) => {
      try {
        const user = JSON.parse(localStorage.getItem('user'))
        const shopId = user ? user.shopId : null
        
        if (!shopId) {
          throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
        }

        if (isCheckIn) {
          await props.attendanceStore.checkIn(parseInt(shopId), shift.id, memo)
        } else {
          await props.attendanceStore.checkOut(parseInt(shopId), shift.id, memo)
        }
        
        // 성공 시 오늘의 근무 일정 다시 조회
        await props.attendanceStore.fetchTodayWorkshifts()
        
        emit('attendance-updated')
      } catch (error) {
        console.error('출퇴근 처리 실패:', error)
        // 에러는 store에서 처리됨
      }
    }

    // 메모 모달 처리 함수들
    const handleProceedWithMemo = async (memo) => {
      showMemoModal.value = false
      await processAttendance(memoModalData.value.shift, memoModalData.value.isCheckIn, memo)
    }

    const handleProceedWithoutMemo = async () => {
      showMemoModal.value = false
      await processAttendance(memoModalData.value.shift, memoModalData.value.isCheckIn)
    }

    const handleCancelMemo = () => {
      showMemoModal.value = false
      memoModalData.value = { shift: null, isCheckIn: true, irregularityType: '', timeDifference: 0 }
    }

    // 근무 일정 새로고침
    const refreshWorkshifts = async () => {
      try {
        await props.attendanceStore.fetchTodayWorkshifts()
      } catch (error) {
        console.error('근무 일정 새로고침 실패:', error)
      }
    }

    // 근무 생성 완료 처리
    const handleShiftCreated = async (shiftData) => {
      try {
        await workshiftStore.createMyWorkshift(shiftData)
        showCreateShiftModal.value = false
        await refreshWorkshifts()
        emit('attendance-updated')
      } catch (error) {
        console.error('근무 일정 생성 실패:', error)
        // 에러는 workshift store에서 처리됨
      }
    }

    return {
      showCreateShiftModal,
      showMemoModal,
      memoModalData,
      todayShifts,
      isShiftActive,
      isShiftCompleted,
      isShiftUpcoming,
      canCheckInToShift,
      canCheckOutFromShift,
      getShiftStatusBadge,
      formatDate,
      formatTime,
      formatShiftTime,
      getShiftDuration,
      checkInToShift,
      checkOutFromShift,
      refreshWorkshifts,
      handleShiftCreated,
      handleProceedWithMemo,
      handleProceedWithoutMemo,
      handleCancelMemo,
    }
  },
  emits: ['attendance-updated']
}
</script>

<style scoped src="@/assets/styles/employee/TodayWorkshifts.css"></style>
