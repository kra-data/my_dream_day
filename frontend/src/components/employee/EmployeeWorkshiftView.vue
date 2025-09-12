<template>
  <div class="employee-workshift-view">
    <div class="workshift-container">
      <!-- 헤더 -->
      <div class="section-header">
        <div class="header-content">
          <h3>
            <AppIcon name="calendar" :size="18" class="inline-block mr-2" />
            내 근무 일정
          </h3>
          <p>이번 주 근무 일정을 확인하고 새 일정을 등록하세요</p>
        </div>
        <div class="header-actions">
          <button @click="openCreateModal" class="btn btn-primary btn-sm">
            <AppIcon name="plus" :size="14" class="mr-1" />
            일정 추가
          </button>
          <button @click="refreshWorkshifts" class="btn btn-secondary btn-sm" :disabled="workshiftStore.loading">
            <AppIcon name="arrows-up-down" :size="14" class="mr-1" />
            새로고침
          </button>
        </div>
      </div>

      <!-- 이번 주 근무 일정 -->
      <div class="weekly-shifts">
        <div class="week-nav">
          <button @click="previousWeek" class="week-nav-btn">
            <AppIcon name="chevron-left" :size="16" />
          </button>
          <h4>{{ currentWeekLabel }}</h4>
          <button @click="nextWeek" class="week-nav-btn">
            <AppIcon name="chevron-right" :size="16" />
          </button>
        </div>

        <div v-if="workshiftStore.loading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>근무 일정을 불러오는 중...</p>
        </div>

        <div v-else-if="weeklyShifts.length === 0" class="empty-state">
          <div class="empty-icon">
            <AppIcon name="clipboard" :size="48" />
          </div>
          <p>이번 주 근무 일정이 없습니다</p>
          <button @click="openCreateModal" class="btn btn-primary">
            첫 번째 일정 등록하기
          </button>
        </div>

        <div v-else class="shifts-grid">
          <div
            v-for="shift in weeklyShifts"
            :key="shift.id"
            :class="[
              'shift-card',
              {
                'shift-today': isShiftToday(shift),
                'shift-active': workshiftStore.isShiftActive(shift),
                'shift-upcoming': workshiftStore.isShiftUpcoming(shift)
              }
            ]"
          >
            <div class="shift-date">
              <span class="date-day">{{ formatShiftDate(shift.startAt).day }}</span>
              <span class="date-weekday">{{ formatShiftDate(shift.startAt).weekday }}</span>
            </div>
            
            <div class="shift-details">
              <div class="shift-time">
                <span class="time-range">{{ workshiftStore.formatShiftTime(shift.startAt, shift.endAt) }}</span>
                <span class="duration">{{ workshiftStore.getShiftDuration(shift.startAt, shift.endAt) }}</span>
              </div>
              
              <div class="shift-status">
                <StatusBadge :status="workshiftStore.getShiftStatus(shift)" />
              </div>
            </div>

            <div class="shift-actions">
              <button 
                v-if="workshiftStore.isShiftUpcoming(shift)"
                @click="handleEditShift(shift)" 
                class="action-btn edit-btn"
                title="일정 수정"
              >
                <AppIcon name="edit" :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 다가오는 근무 일정 -->
      <div v-if="upcomingShifts.length > 0" class="upcoming-shifts">
        <h4><AppIcon name="clock" :size="16" class="inline-block mr-1" />다가오는 근무 일정</h4>
        <div class="upcoming-list">
          <div
            v-for="shift in upcomingShifts.slice(0, 3)"
            :key="shift.id"
            class="upcoming-item"
          >
            <div class="upcoming-date">
              <span class="upcoming-day">{{ formatUpcomingDate(shift.startAt).date }}</span>
              <span class="upcoming-weekday">{{ formatUpcomingDate(shift.startAt).weekday }}</span>
            </div>
            
            <div class="upcoming-info">
              <div class="upcoming-time">{{ workshiftStore.formatShiftTime(shift.startAt, shift.endAt) }}</div>
              <div class="upcoming-duration">{{ workshiftStore.getShiftDuration(shift.startAt, shift.endAt) }}</div>
            </div>
            
            <div class="upcoming-countdown">
              {{ getTimeUntilShift(shift.startAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 에러 메시지 -->
      <div v-if="workshiftStore.error" class="error-message">
        {{ workshiftStore.error }}
        <button @click="workshiftStore.clearError" class="error-close">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
    </div>

    <!-- 근무 일정 생성 모달 -->
    <EmployeeWorkshiftCreateModal
      v-if="showCreateModal"
      :selected-date="createModalDate"
      :store-error="workshiftStore.error"
      @create="handleCreateWorkshift"
      @close="closeCreateModal"
    />

    <!-- 근무 일정 수정 모달 -->
    <EmployeeWorkshiftEditModal
      v-if="showEditModal && selectedShift"
      :shift="selectedShift"
      @update="handleUpdateWorkshift"
      @close="closeEditModal"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'
import { useAuthStore } from '@/stores/auth'
import StatusBadge from '@/components/StatusBadge.vue'
import EmployeeWorkshiftCreateModal from './EmployeeWorkshiftCreateModal.vue'
import EmployeeWorkshiftEditModal from './EmployeeWorkshiftEditModal.vue'

export default {
  name: 'EmployeeWorkshiftView',
  components: {
    StatusBadge,
    EmployeeWorkshiftCreateModal,
    EmployeeWorkshiftEditModal
  },
  setup() {
    const workshiftStore = useWorkshiftStore()
    const authStore = useAuthStore()
    
    const currentWeek = ref(new Date())
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const selectedShift = ref(null)
    const createModalDate = ref(null)
    
    // 현재 주의 라벨
    const currentWeekLabel = computed(() => {
      const startOfWeek = getStartOfWeek(currentWeek.value)
      const endOfWeek = getEndOfWeek(currentWeek.value)
      
      const startStr = startOfWeek.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })
      const endStr = endOfWeek.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })
      
      return `${startStr} ~ ${endStr}`
    })
    
    // 이번 주 근무 일정
    const weeklyShifts = computed(() => {
      const startOfWeek = getStartOfWeek(currentWeek.value)
      const endOfWeek = getEndOfWeek(currentWeek.value)
      
      return workshiftStore.myWorkshifts
        .filter(shift => {
          const shiftDate = new Date(shift.startAt)
          return shiftDate >= startOfWeek && shiftDate <= endOfWeek
        })
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    })
    
    // 다가오는 근무 일정 (이번 주 이후)
    const upcomingShifts = computed(() => {
      const endOfWeek = getEndOfWeek(currentWeek.value)
      const now = new Date()
      
      return workshiftStore.myWorkshifts
        .filter(shift => {
          const shiftDate = new Date(shift.startAt)
          return shiftDate > endOfWeek && shiftDate > now
        })
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    })
    
    const getStartOfWeek = (date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = d.getDate() - day // 일요일을 주의 시작으로
      return new Date(d.setDate(diff))
    }
    
    const getEndOfWeek = (date) => {
      const startOfWeek = getStartOfWeek(date)
      return new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
    }
    
    const previousWeek = () => {
      currentWeek.value = new Date(currentWeek.value.getTime() - 7 * 24 * 60 * 60 * 1000)
      refreshWorkshifts()
    }
    
    const nextWeek = () => {
      currentWeek.value = new Date(currentWeek.value.getTime() + 7 * 24 * 60 * 60 * 1000)
      refreshWorkshifts()
    }
    
    const refreshWorkshifts = async () => {
      // Fetch current month data
      const now = new Date()
      await workshiftStore.fetchMyWorkshifts(
        now.getMonth() + 1, // month is 1-based
        now.getFullYear()
      )
    }
    
    const isShiftToday = (shift) => {
      const today = new Date()
      const shiftDate = new Date(shift.startAt)
      
      return today.toDateString() === shiftDate.toDateString()
    }
    
    const formatShiftDate = (startAt) => {
      const date = new Date(startAt)
      const weekdays = ['일', '월', '화', '수', '목', '금', '토']
      
      return {
        day: date.getDate(),
        weekday: weekdays[date.getDay()]
      }
    }
    
    const formatUpcomingDate = (startAt) => {
      const date = new Date(startAt)
      const weekdays = ['일', '월', '화', '수', '목', '금', '토']
      
      return {
        date: date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        }),
        weekday: weekdays[date.getDay()]
      }
    }
    
    const getTimeUntilShift = (startAt) => {
      const now = new Date()
      const shiftTime = new Date(startAt)
      const diffMs = shiftTime - now
      
      if (diffMs < 0) return '시작됨'
      
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      
      if (days > 0) {
        return `${days}일 후`
      } else if (hours > 0) {
        return `${hours}시간 후`
      } else {
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        return `${minutes}분 후`
      }
    }
    
    const handleCreateWorkshift = async (shiftData) => {
      try {
        await workshiftStore.createMyWorkshift(shiftData)
        // 성공시에만 모달 닫기
        closeCreateModal()
        await refreshWorkshifts()
      } catch (error) {
        console.error('Failed to create workshift:', error)
        // 에러 발생시 모달을 닫지 않음 - 사용자가 에러 메시지를 볼 수 있도록
      }
    }
    
    const handleEditShift = (shift) => {
      selectedShift.value = shift
      showEditModal.value = true
    }
    
    const handleUpdateWorkshift = async (shiftData) => {
      try {
        // Employee can only edit their own shifts via the my workshifts API
        // This would require a different API endpoint for employee updates
        console.log('Update shift data:', shiftData)
        // For now, we'll show a message that updates need admin approval
        alert('근무 일정 변경은 관리자 승인이 필요합니다. 관리자에게 문의해주세요.')
        closeEditModal()
      } catch (error) {
        console.error('Failed to update workshift:', error)
      }
    }
    
    const openCreateModal = () => {
      // 새 모달을 열 때 이전 에러 제거
      workshiftStore.error = ''
      showCreateModal.value = true
    }
    
    const closeCreateModal = () => {
      // 모달 닫을 때 에러도 함께 제거
      workshiftStore.error = ''
      showCreateModal.value = false
      createModalDate.value = null
    }
    
    const closeEditModal = () => {
      showEditModal.value = false
      selectedShift.value = null
    }
    
    // 데이터 초기화
    onMounted(async () => {
      await refreshWorkshifts()
    })
    
    // 주가 변경되면 데이터 새로고침
    watch(currentWeek, () => {
      refreshWorkshifts()
    })
    
    return {
      workshiftStore,
      authStore,
      currentWeek,
      currentWeekLabel,
      weeklyShifts,
      upcomingShifts,
      showCreateModal,
      showEditModal,
      selectedShift,
      createModalDate,
      previousWeek,
      nextWeek,
      refreshWorkshifts,
      isShiftToday,
      formatShiftDate,
      formatUpcomingDate,
      getTimeUntilShift,
      handleCreateWorkshift,
      handleEditShift,
      handleUpdateWorkshift,
      openCreateModal,
      closeCreateModal,
      closeEditModal
    }
  }
}
</script>

<style scoped>
.employee-workshift-view {
  margin: 20px 0;
}

.workshift-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.header-content h3 {
  margin: 0 0 4px 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.header-content p {
  margin: 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
  font-size: 0.8rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.75rem;
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

.weekly-shifts {
  padding: 20px 24px;
}

.week-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.week-nav h4 {
  margin: 0;
  color: #1f2937;
  font-size: 1rem;
}

.week-nav-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.week-nav-btn:hover {
  background: #f3f4f6;
}

.loading-container {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}


.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.empty-state p {
  color: #6b7280;
  margin-bottom: 16px;
}

.shifts-grid {
  display: grid;
  gap: 12px;
}

.shift-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #e5e7eb;
  transition: all 0.2s;
}

.shift-card:hover {
  background: #f1f5f9;
}

.shift-card.shift-today {
  border-left-color: #3b82f6;
  background: #dbeafe;
}

.shift-card.shift-active {
  border-left-color: #10b981;
  background: #d1fae5;
}

.shift-card.shift-upcoming {
  border-left-color: #f59e0b;
}

.shift-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 16px;
  min-width: 50px;
}

.date-day {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
}

.date-weekday {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}

.shift-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shift-time {
  display: flex;
  flex-direction: column;
}

.time-range {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.9rem;
}

.duration {
  font-size: 0.8rem;
  color: #6b7280;
}

.shift-actions {
  margin-left: 12px;
}

.action-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: rgba(0,0,0,0.05);
}

.upcoming-shifts {
  padding: 20px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fafbfc;
}

.upcoming-shifts h4 {
  margin: 0 0 16px 0;
  color: #1f2937;
  font-size: 0.95rem;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcoming-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.upcoming-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 16px;
  min-width: 60px;
}

.upcoming-day {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f2937;
}

.upcoming-weekday {
  font-size: 0.75rem;
  color: #6b7280;
}

.upcoming-info {
  flex: 1;
}

.upcoming-time {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.85rem;
}

.upcoming-duration {
  font-size: 0.75rem;
  color: #6b7280;
}

.upcoming-countdown {
  font-size: 0.8rem;
  color: #3b82f6;
  font-weight: 500;
}

.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.9rem;
}

.error-close {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.error-close:hover {
  background: rgba(220, 38, 38, 0.1);
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: stretch;
  }
  
  .header-actions .btn {
    flex: 1;
  }
  
  .shift-card {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .shift-details {
    justify-content: space-between;
  }
  
  .upcoming-item {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>