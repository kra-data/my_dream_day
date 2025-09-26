<template>
  <div class="workshift-view">
    <!-- 캘린더 컴포넌트 -->
    <WorkshiftCalendar
      :workshifts="workshiftStore.calendarWorkshifts"
      :selected-date="workshiftStore.selectedDate"
      :loading="workshiftStore.loading"
      :employees="employeesStore.employees"
      @date-select="handleDateSelect"
      @shift-select="handleShiftSelect"
      @create-shift="handleCreateShift"
      @employee-filter="handleEmployeeFilter"
      @refresh="refreshData"
      @create-new="() => showCreateModal = true"
    />

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
              <div 
                class="employee-avatar"
                :style="{ backgroundColor: shift.employee?.personalColor || getDefaultPersonalColor(shift.employee?.position) }"
              >
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
              <AppIcon name="edit" :size="14" class="mr-1" />
              수정
            </button>
            <button @click="handleDeleteShift(shift)" class="btn btn-sm btn-danger">
              <AppIcon name="delete" :size="14" class="mr-1" />
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
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
import StatusBadge from '@/components/common/alarm/StatusBadge.vue'
import WorkshiftCalendar from '@/components/AdminWorkshiftView/AdminWorkshiftCalendar.vue'
import WorkshiftCreateModal from '@/components/AdminWorkshiftView/AdminWorkshiftCreateModal.vue'
import WorkshiftEditModal from '@/components/AdminWorkshiftView/AdminWorkshiftEditModal.vue'

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
        // Format data for admin API
        // For now, assume schedule modification (startAt, endAt, status)
        // Future: Could add logic to detect if it's attendance modification
        const adminUpdateData = {
          startAt: shiftData.startAt,
          endAt: shiftData.endAt,
          status: shiftData.status
        }

        console.log('Admin updating workshift:', {
          shopId: authStore.user.shopId,
          shiftId: selectedShift.value.id,
          updateData: adminUpdateData
        })

        // Use admin API for updating employee workshifts
        const result = await workshiftStore.updateEmployeeWorkshift(
          authStore.user.shopId,
          selectedShift.value.id,
          adminUpdateData
        )

        console.log('Admin workshift update successful:', result)
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
        // Use admin API for deleting employee workshifts
        await workshiftStore.deleteEmployeeWorkshift(authStore.user.shopId, shift.id)
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
    
    const handleEmployeeFilter = async (employeeId) => {
      selectedEmployeeId.value = employeeId || ''
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
    },
    
    getDefaultPersonalColor(position) {
      const positionColors = {
        'OWNER': '#dc2626',     // red-600
        'MANAGER': '#2563eb',   // blue-600  
        'STAFF': '#059669',     // emerald-600
        'PART_TIME': '#7c3aed'  // violet-600
      }
      return positionColors[position] || '#6b7280' // gray-500 as default
    }
  }
}
</script>

<style scoped src="@/assets/styles/views/admin/AdminWorkshiftView.css"></style>
