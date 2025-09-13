import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const useWorkshiftStore = defineStore('workshift', () => {
  // State
  const workshifts = ref([])
  const myWorkshifts = ref([])
  const reviewWorkshifts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedDate = ref(new Date()) // Today's date as default
  const calendarWorkshifts = ref([])

  // Get API instance from auth store
  const getApiInstance = () => {
    const authStore = useAuthStore()
    return authStore.getApiInstance()
  }

  // Employee APIs
  const fetchMyWorkshifts = async (month = null, year = null) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const params = {}
      
      // If no month/year provided, use current month
      const targetDate = new Date()
      if (year !== null) targetDate.setFullYear(year)
      if (month !== null) targetDate.setMonth(month - 1) // month is 1-based
      
      // Calculate month boundaries - Date.toISOString() automatically converts to UTC
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)
      
      // toISOString() automatically converts local time to UTC for backend API
      params.from = startOfMonth.toISOString()
      params.to = endOfMonth.toISOString()
      
      const response = await api.get('/my/workshifts', { params })
      myWorkshifts.value = response.data || []
      
      console.log(`내 근무 일정 조회 완료 (${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월):`, myWorkshifts.value.length, '건')
      return myWorkshifts.value
    } catch (err) {
      error.value = err.response?.data?.message || '내 근무 일정을 불러오는데 실패했습니다'
      console.error('Failed to fetch my workshifts:', err)
      myWorkshifts.value = []
      return []
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
      // Handle specific error cases
      if (err.response?.status === 409) {
        error.value = err.response?.data?.error || '이미 겹치는 근무일정이 있습니다.'
      } else {
        error.value = err.response?.data?.message || '근무 일정 생성에 실패했습니다'
      }
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

  const fetchReviewWorkshifts = async (shopId) => {
    if (!shopId) {
      throw new Error('shopId is required for fetching review workshifts')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const response = await api.get(`/admin/shops/${shopId}/workshifts/review`, {
      })
      reviewWorkshifts.value = response.data?.items || []
      
      return reviewWorkshifts.value
    } catch (err) {
      error.value = err.response?.data?.message || '검토 필요한 근무 일정을 불러오는데 실패했습니다'
      console.error('Failed to fetch review workshifts:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const resolveReviewWorkshift = async (shopId, workshiftId, newStatus, updateData = {}) => {
    if (!shopId) {
      throw new Error('shopId is required for resolving review workshift')
    }
    if (!workshiftId) {
      throw new Error('workshiftId is required for resolving review workshift')
    }
    if (!newStatus || !['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(newStatus)) {
      throw new Error('Valid status (SCHEDULED/COMPLETED/CANCELLED) is required')
    }
    
    // Find the workshift to get its current data
    const workshift = reviewWorkshifts.value.find(shift => shift.id === workshiftId)
    if (!workshift) {
      throw new Error('Workshift not found')
    }
    
    try {
      // Use the existing updateWorkshift function with the new status and updated times
      const updatedWorkshift = await updateWorkshift(shopId, workshiftId, {
        startAt: updateData.startAt || workshift.startAt,
        endAt: updateData.endAt || workshift.endAt,
        status: newStatus,
        adminNote: updateData.adminNote
      })
      
      // Remove resolved workshift from review list
      reviewWorkshifts.value = reviewWorkshifts.value.filter(shift => shift.id !== workshiftId)
      
      return updatedWorkshift
    } catch (err) {
      error.value = err.response?.data?.message || '근무 일정 검토 처리에 실패했습니다'
      console.error('Failed to resolve review workshift:', err)
      throw err
    }
  }

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

  // New filtering utilities for EmployeeView - using UTC for internal logic
  const getTodayWorkshifts = () => {
    const today = new Date()
    // Use local date for comparison, not UTC
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    return myWorkshifts.value.filter(shift => {
      // Convert UTC time to local date for comparison
      const shiftDate = new Date(shift.startAt)
      const shiftDateStr = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`
      const status = shift.status || 'SCHEDULED'
      return shiftDateStr === todayDateStr && status !== 'CANCELED'
    })
  }
  
  const getThisWeekWorkshifts = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday is first day
    
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), diff)
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), diff + 6)
    
    const startDateStr = startOfWeek.toISOString().split('T')[0]
    const endDateStr = endOfWeek.toISOString().split('T')[0]
    
    return myWorkshifts.value.filter(shift => {
      const shiftDateStr = new Date(shift.startAt).toISOString().split('T')[0]
      const status = shift.status || 'SCHEDULED'
      return shiftDateStr >= startDateStr && shiftDateStr <= endDateStr && status !== 'CANCELED'
    })
  }
  
  const getWorkshiftsByDateRange = (startDate, endDate) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return myWorkshifts.value.filter(shift => {
      const shiftStart = new Date(shift.startAt)
      // Hide CANCELED workshifts from employee view
      const status = shift.status || 'SCHEDULED'
      return shiftStart >= start && shiftStart <= end && status !== 'CANCELED'
    })
  }
  
  const resetState = () => {
    workshifts.value = []
    myWorkshifts.value = []
    calendarWorkshifts.value = []
    reviewWorkshifts.value = []
    error.value = null
    loading.value = false
  }

  return {
    // State
    workshifts,
    myWorkshifts,
    calendarWorkshifts,
    reviewWorkshifts,
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
    fetchReviewWorkshifts,
    resolveReviewWorkshift,

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
    resetState,
    
    // New filtering utilities
    getTodayWorkshifts,
    getThisWeekWorkshifts,
    getWorkshiftsByDateRange
  }
})