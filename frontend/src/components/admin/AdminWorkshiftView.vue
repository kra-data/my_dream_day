<template>
  <div class="workshift-view">
    <div class="workshift-header">
      <div class="header-content">
        <h2>📅 근무 일정 관리</h2>
        <p>직원들의 근무 일정을 관리하고 달력으로 확인하세요</p>
      </div>
      <div class="header-actions">
        <div class="employee-filter">
          <select 
            v-model="selectedEmployeeId" 
            @change="handleEmployeeFilter"
            class="employee-select"
          >
            <option value="">전체 직원</option>
            <option 
              v-for="employee in employeesStore.employees" 
              :key="employee.id" 
              :value="employee.id"
            >
              {{ employee.name }} ({{ formatSection(employee.section) }})
            </option>
          </select>
        </div>
        <button @click="showCreateModal = true" class="btn btn-primary">
          ➕ 새 일정 등록
        </button>
        <button @click="refreshData" class="btn btn-secondary" :disabled="workshiftStore.loading">
          🔄 새로고침
        </button>
      </div>
    </div>

    <!-- 달력 뷰 -->
    <div class="calendar-container">
      <WorkshiftCalendar 
        :workshifts="workshiftStore.calendarWorkshifts"
        :selected-date="workshiftStore.selectedDate"
        :loading="workshiftStore.loading"
        @date-select="handleDateSelect"
        @shift-select="handleShiftSelect"
        @create-shift="handleCreateShift"
      />
    </div>

    <!-- 선택된 날짜의 일정 목록 -->
    <div v-if="selectedDateShifts.length > 0" class="daily-shifts">
      <h3>{{ formatSelectedDate }} 근무 일정</h3>
      <div class="shifts-list">
        <div 
          v-for="shift in selectedDateShifts" 
          :key="shift.id"
          class="shift-item"
          :class="`shift-status-${shift.status?.toLowerCase() || 'scheduled'}`"
        >
          <div class="shift-info">
            <div class="employee-info">
              <div class="employee-avatar">
                {{ shift.employee?.name?.charAt(0) || 'U' }}
              </div>
              <div class="employee-details">
                <span class="employee-name">{{ shift.employee?.name || '이름 없음' }}</span>
                <span class="employee-dept">
                  {{ formatSection(shift.employee?.section) }} · {{ formatPosition(shift.employee?.position) }}
                </span>
              </div>
            </div>
            
            <div class="shift-time">
              <span class="time-range">{{ workshiftStore.formatShiftTime(shift.startAt, shift.endAt) }}</span>
              <span class="duration">{{ workshiftStore.getShiftDuration(shift.startAt, shift.endAt) }}</span>
            </div>
            
            <div class="shift-status">
              <StatusBadge :status="workshiftStore.getShiftStatus(shift)" />
            </div>
          </div>
          
          <div class="shift-actions">
            <button @click="handleEditShift(shift)" class="btn btn-sm btn-outline">
              ✏️ 수정
            </button>
            <button @click="handleDeleteShift(shift)" class="btn btn-sm btn-danger">
              🗑️ 삭제
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 새 일정 생성 모달 -->
    <WorkshiftCreateModal
      v-if="showCreateModal"
      :employees="employeesStore.employees"
      :selected-date="createModalDate"
      @create="handleCreateWorkshift"
      @close="closeCreateModal"
    />

    <!-- 일정 수정 모달 -->
    <WorkshiftEditModal
      v-if="showEditModal && selectedShift"
      :shift="selectedShift"
      :employees="employeesStore.employees"
      @update="handleUpdateWorkshift"
      @close="closeEditModal"
    />
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useWorkshiftStore } from '@/stores/workshift'
import { useEmployeesStore } from '@/stores/employees'
import { useAuthStore } from '@/stores/auth'
import StatusBadge from '@/components/StatusBadge.vue'
import WorkshiftCalendar from '@/components/WorkshiftCalendar.vue'
import WorkshiftCreateModal from '@/components/WorkshiftCreateModal.vue'
import WorkshiftEditModal from '@/components/WorkshiftEditModal.vue'

export default {
  name: 'AdminWorkshiftView',
  components: {
    StatusBadge,
    WorkshiftCalendar,
    WorkshiftCreateModal,
    WorkshiftEditModal
  },
  setup() {
    const workshiftStore = useWorkshiftStore()
    const employeesStore = useEmployeesStore()
    const authStore = useAuthStore()
    
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const selectedShift = ref(null)
    const createModalDate = ref(null)
    const selectedEmployeeId = ref('')
    
    const selectedDateShifts = computed(() => {
      return workshiftStore.getWorkshiftsByDate(workshiftStore.selectedDate)
    })
    
    const formatSelectedDate = computed(() => {
      return new Date(workshiftStore.selectedDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    })
    
    const handleDateSelect = (date) => {
      workshiftStore.setSelectedDate(date)
    }
    
    const handleShiftSelect = (shift) => {
      selectedShift.value = shift
      showEditModal.value = true
    }
    
    const handleCreateShift = (date) => {
      createModalDate.value = date
      showCreateModal.value = true
    }
    
    const handleCreateWorkshift = async (shiftData) => {
      try {
        await workshiftStore.createEmployeeWorkshift(
          authStore.user.shopId,
          shiftData.employeeId,
          {
            startAt: shiftData.startAt,
            endAt: shiftData.endAt
          }
        )
        
        closeCreateModal()
        await refreshData()
      } catch (error) {
        console.error('Failed to create workshift:', error)
        alert(`근무 일정 생성에 실패했습니다: ${error.message}`)
      }
    }
    
    const handleEditShift = (shift) => {
      selectedShift.value = shift
      showEditModal.value = true
    }
    
    const handleUpdateWorkshift = async (shiftData) => {
      try {
        await workshiftStore.updateWorkshift(
          authStore.user.shopId,
          selectedShift.value.id,
          shiftData
        )
        
        closeEditModal()
        await refreshData()
      } catch (error) {
        console.error('Failed to update workshift:', error)
        alert(`근무 일정 수정에 실패했습니다: ${error.message}`)
      }
    }
    
    const handleDeleteShift = async (shift) => {
      if (!confirm(`${shift.employee?.name}님의 ${formatShiftTime(shift.startAt, shift.endAt)} 근무 일정을 삭제하시겠습니까?`)) {
        return
      }
      
      try {
        await workshiftStore.deleteWorkshift(authStore.user.shopId, shift.id)
        await refreshData()
      } catch (error) {
        console.error('Failed to delete workshift:', error)
        alert(`근무 일정 삭제에 실패했습니다: ${error.message}`)
      }
    }
    
    const closeCreateModal = () => {
      showCreateModal.value = false
      createModalDate.value = null
    }
    
    const closeEditModal = () => {
      showEditModal.value = false
      selectedShift.value = null
    }
    
    const refreshData = async () => {
      await workshiftStore.fetchCalendarWorkshifts(
        authStore.user?.shopId, 
        selectedEmployeeId.value || null
      )
    }
    
    const handleEmployeeFilter = async () => {
      await refreshData() // 단순히 새 데이터 로드
    }
    
    const formatShiftTime = (startAt, endAt) => {
      return workshiftStore.formatShiftTime(startAt, endAt)
    }
    
    // No onMounted - let AdminView handle the initial load
    
    return {
      workshiftStore,
      employeesStore,
      authStore,
      showCreateModal,
      showEditModal,
      selectedShift,
      createModalDate,
      selectedEmployeeId,
      selectedDateShifts,
      formatSelectedDate,
      handleDateSelect,
      handleShiftSelect,
      handleCreateShift,
      handleCreateWorkshift,
      handleEditShift,
      handleUpdateWorkshift,
      handleDeleteShift,
      closeCreateModal,
      closeEditModal,
      refreshData,
      handleEmployeeFilter,
      formatShiftTime
    }
  },
  methods: {
    formatSection(section) {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section
    },
    
    formatPosition(position) {
      const positions = {
        'OWNER': '오너',
        'MANAGER': '매니저', 
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position
    }
  }
}
</script>

<style scoped>
.workshift-view {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.workshift-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.header-content h2 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 1.5rem;
}

.header-content p {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-filter {
  display: flex;
  align-items: center;
}

.employee-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 180px;
  cursor: pointer;
  transition: all 0.2s;
}

.employee-select:hover {
  border-color: #3b82f6;
}

.employee-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.calendar-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.daily-shifts {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.daily-shifts h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
  font-size: 1.2rem;
}

.shifts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shift-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #e5e7eb;
  background: #f8fafc;
  transition: all 0.2s;
}

.shift-item:hover {
  background: #f1f5f9;
}

.shift-item.shift-status-scheduled {
  border-left-color: #3b82f6;
}

.shift-item.shift-status-active {
  border-left-color: #10b981;
}

.shift-item.shift-status-completed {
  border-left-color: #6b7280;
}

.shift-info {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.employee-details {
  display: flex;
  flex-direction: column;
}

.employee-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.95rem;
}

.employee-dept {
  font-size: 0.85rem;
  color: #6b7280;
}

.shift-time {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
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

.btn-outline {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-outline:hover {
  background: #3b82f6;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

@media (max-width: 768px) {
  .workshift-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    gap: 12px;
  }
  
  .employee-filter {
    width: 100%;
  }
  
  .employee-select {
    width: 100%;
    min-width: auto;
  }
  
  .header-actions .btn {
    flex: 1;
  }
  
  .shift-item {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .shift-info {
    flex-direction: column;
    gap: 12px;
  }
  
  .shift-actions {
    justify-content: stretch;
  }
  
  .shift-actions .btn {
    flex: 1;
  }
}
</style>