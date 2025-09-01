import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const useWorkshiftStore = defineStore('workshift', () => {
  // State
  const workshifts = ref([])
  const myWorkshifts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedDate = ref(new Date(2025, 8, 1)) // September 2025
  const calendarWorkshifts = ref([])

  // Get API instance from auth store
  const getApiInstance = () => {
    const authStore = useAuthStore()
    return authStore.getApiInstance()
  }

  // Employee APIs
  const fetchMyWorkshifts = async (from = null, to = null) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      
      const response = await api.get('/my/workshifts', { params })
      myWorkshifts.value = response.data || []
      
      return myWorkshifts.value
    } catch (err) {
      error.value = err.response?.data?.message || '내 근무 일정을 불러오는데 실패했습니다'
      console.error('Failed to fetch my workshifts:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createMyWorkshift = async (shiftData) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const response = await api.post('/my/workshifts', {
        startAt: shiftData.startAt,
        endAt: shiftData.endAt
      })
      
      const newShift = response.data
      myWorkshifts.value.push(newShift)
      
      // 새로운 일정이 현재 캘린더 월에 해당하는 경우에만 추가
      const shiftDate = new Date(newShift.startAt)
      const currentDate = selectedDate.value
      if (shiftDate.getFullYear() === currentDate.getFullYear() && 
          shiftDate.getMonth() === currentDate.getMonth()) {
        calendarWorkshifts.value.push(newShift)
      }
      
      return newShift
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정 생성에 실패했습니다'
      console.error('Failed to create my workshift:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Admin APIs
  const fetchAllWorkshifts = async (shopId, from = null, to = null, employeeId = null) => {
    if (!shopId) {
      throw new Error('shopId is required for fetching workshifts')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      if (employeeId) params.employeeId = employeeId
      
      const response = await api.get(`/admin/shops/${shopId}/workshifts`, { params })
      workshifts.value = response.data || []
      
      return workshifts.value
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정을 불러오는데 실패했습니다'
      console.error('Failed to fetch all workshifts:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createEmployeeWorkshift = async (shopId, employeeId, shiftData) => {
    if (!shopId) {
      throw new Error('shopId is required for creating employee workshift')
    }
    if (!employeeId) {
      throw new Error('employeeId is required for creating employee workshift')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const response = await api.post(`/admin/shops/${shopId}/employees/${employeeId}/workshifts`, {
        startAt: shiftData.startAt,
        endAt: shiftData.endAt
      })
      
      const newShift = response.data
      workshifts.value.push(newShift)
      
      // 새로운 일정이 현재 캘린더 월에 해당하는 경우에만 추가
      const shiftDate = new Date(newShift.startAt)
      const currentDate = selectedDate.value
      if (shiftDate.getFullYear() === currentDate.getFullYear() && 
          shiftDate.getMonth() === currentDate.getMonth()) {
        calendarWorkshifts.value.push(newShift)
      }
      
      return newShift
    } catch (err) {
      error.value = err.response?.data?.message || '직원 근무 일정 생성에 실패했습니다'
      console.error('Failed to create employee workshift:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateWorkshift = async (shopId, shiftId, shiftData) => {
    if (!shopId) {
      throw new Error('shopId is required for updating workshift')
    }
    if (!shiftId) {
      throw new Error('shiftId is required for updating workshift')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const response = await api.put(`/admin/shops/${shopId}/workshifts/${shiftId}`, {
        startAt: shiftData.startAt,
        endAt: shiftData.endAt,
        status: shiftData.status || 'SCHEDULED'
      })
      
      const updatedShift = response.data
      const index = workshifts.value.findIndex(shift => shift.id === shiftId)
      if (index !== -1) {
        workshifts.value[index] = updatedShift
      }
      
      // Update calendar data as well
      const calendarIndex = calendarWorkshifts.value.findIndex(shift => shift.id === shiftId)
      if (calendarIndex !== -1) {
        calendarWorkshifts.value[calendarIndex] = updatedShift
      }
      
      return updatedShift
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정 수정에 실패했습니다'
      console.error('Failed to update workshift:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteWorkshift = async (shopId, shiftId) => {
    if (!shopId) {
      throw new Error('shopId is required for deleting workshift')
    }
    if (!shiftId) {
      throw new Error('shiftId is required for deleting workshift')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      await api.delete(`/admin/shops/${shopId}/workshifts/${shiftId}`)
      
      // Remove from local state
      workshifts.value = workshifts.value.filter(shift => shift.id !== shiftId)
      calendarWorkshifts.value = calendarWorkshifts.value.filter(shift => shift.id !== shiftId)
      
      return true
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정 삭제에 실패했습니다'
      console.error('Failed to delete workshift:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Simple calendar workshifts fetch - NO COMPLEX CACHING
  const fetchCalendarWorkshifts = async (shopId = null, employeeId = null) => {
    const authStore = useAuthStore()
    const currentUser = authStore.user
    
    if (!currentUser || loading.value) {
      return calendarWorkshifts.value
    }

    loading.value = true
    error.value = null

    try {
      if (currentUser.role === 'admin') {
        const targetShopId = shopId || currentUser.shopId
        
        if (!targetShopId) {
          error.value = 'shopId가 필요합니다'
          return []
        }
        
        // Simple month calculation
        const currentDate = selectedDate.value
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const from = new Date(year, month, 1).toISOString()
        const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
        
        const api = getApiInstance()
        const params = { from, to }
        
        if (employeeId) {
          params.employeeId = employeeId
        }
        
        console.log('Fetching workshifts:', { targetShopId, from, to, employeeId })
        const response = await api.get(`/admin/shops/${targetShopId}/workshifts`, { params })
        
        const shifts = response.data || []
        calendarWorkshifts.value = shifts
        return shifts
      } else {
        // Employee view
        const currentDate = selectedDate.value
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const from = new Date(year, month, 1).toISOString()
        const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
        
        const shifts = await fetchMyWorkshifts(from, to)
        calendarWorkshifts.value = shifts
        return shifts
      }
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정을 불러오는데 실패했습니다'
      console.error('Failed to fetch calendar workshifts:', err)
      calendarWorkshifts.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  const setSelectedDate = (date) => {
    // 같은 날짜인 경우 업데이트 하지 않음 (불필요한 리렌더링 방지)
    const newDate = new Date(date)
    const currentDate = selectedDate.value
    
    if (currentDate && 
        newDate.getFullYear() === currentDate.getFullYear() &&
        newDate.getMonth() === currentDate.getMonth() &&
        newDate.getDate() === currentDate.getDate()) {
      return
    }
    
    selectedDate.value = newDate
  }

  // Utility functions
  const getWorkshiftsByDate = (date) => {
    const targetDate = new Date(date)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
    
    return calendarWorkshifts.value.filter(shift => {
      const shiftStart = new Date(shift.startAt)
      const shiftEnd = new Date(shift.endAt)
      
      return (shiftStart >= startOfDay && shiftStart <= endOfDay) ||
             (shiftEnd >= startOfDay && shiftEnd <= endOfDay) ||
             (shiftStart < startOfDay && shiftEnd > endOfDay)
    })
  }

  const getWorkshiftsByEmployee = (employeeId) => {
    return workshifts.value.filter(shift => shift.employeeId === employeeId)
  }

  const formatShiftTime = (startAt, endAt) => {
    const start = new Date(startAt)
    const end = new Date(endAt)
    
    const formatTime = (date) => {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
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
    
    return `${diffHours}시간 ${diffMinutes}분`
  }

  const isShiftActive = (shift) => {
    const now = new Date()
    const start = new Date(shift.startAt)
    const end = new Date(shift.endAt)
    
    return now >= start && now <= end
  }

  const isShiftUpcoming = (shift) => {
    const now = new Date()
    const start = new Date(shift.startAt)
    
    return start > now
  }

  const getShiftStatus = (shift) => {
    if (shift.status) return shift.status
    
    if (isShiftActive(shift)) return 'ACTIVE'
    if (isShiftUpcoming(shift)) return 'UPCOMING'
    return 'COMPLETED'
  }

  const clearError = () => {
    error.value = null
  }

  const resetState = () => {
    workshifts.value = []
    myWorkshifts.value = []
    calendarWorkshifts.value = []
    error.value = null
    loading.value = false
  }

  return {
    // State
    workshifts,
    myWorkshifts,
    calendarWorkshifts,
    loading,
    error,
    selectedDate,

    // Employee actions
    fetchMyWorkshifts,
    createMyWorkshift,

    // Admin actions
    fetchAllWorkshifts,
    createEmployeeWorkshift,
    updateWorkshift,
    deleteWorkshift,

    // Calendar actions
    fetchCalendarWorkshifts,
    setSelectedDate,
    getWorkshiftsByDate,
    getWorkshiftsByEmployee,

    // Utility functions
    formatShiftTime,
    getShiftDuration,
    isShiftActive,
    isShiftUpcoming,
    getShiftStatus,
    
    // State management
    clearError,
    resetState
  }
})