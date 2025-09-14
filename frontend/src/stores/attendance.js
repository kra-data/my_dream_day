import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useEmployeesStore } from './employees'

export const useAttendanceStore = defineStore('attendance', () => {
  const records = ref([])
  const todaySummary = ref({
    totalEmployees: 0,
    checkedIn: 0,
    late: 0,
    absent: 0
  })
  const activeEmployees = ref([])
  const recentActivities = ref([])
  const loading = ref(false)
  const error = ref(null)
  const isEmpty = ref(false)

  const currentStatus = ref({
    onDuty: false,
    clockInAt: null,
    workedMinutes: 0,
    extraMinutes: 0
  })


  const employeeRecords = ref([])
  const todayWorkshifts = ref([])
  const getApiInstance = () => {
    const authStore = useAuthStore()
    return authStore.getApiInstance()
  }

  const getShopId = () => {
    const authStore = useAuthStore()
    const user = JSON.parse(localStorage.getItem('user'));
    const shopId = user ? user.shopId : null;
    return authStore.user?.shopId || shopId
  }

  // ============= 현재 사용자 상태 관련 (직원용) =============
  
  const fetchTodayWorkshifts = async () => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const response = await api.get('/my/workshifts/today')
      
      todayWorkshifts.value = response.data || []
      
      console.log('오늘의 근무 일정 조회 완료:', todayWorkshifts.value)
      return todayWorkshifts.value
    } catch (error) {
      console.error('오늘의 근무 일정 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '오늘의 근무 일정을 불러오는데 실패했습니다'
      todayWorkshifts.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  // 직원 마이페이지 개요 정보 조회
  const fetchMyOverview = async () => {
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const response = await api.get('/my/overview')

      console.log('마이페이지 개요 정보 조회 완료:', response.data)
      return response.data
    } catch (error) {
      console.error('마이페이지 개요 정보 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '개요 정보를 불러오는데 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  // 출퇴근 미리보기 API
  const attendancePreview = async (shopId, type, scannedAt, shiftId = null) => {
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const payload = {
        shopId,
        type,
        scannedAt
      }

      // shiftId가 있으면 페이로드에 추가 (퇴근시 사용)
      if (shiftId) {
        payload.shiftId = shiftId
      }

      const response = await api.post('/attendance/preview', payload)

      console.log('출퇴근 미리보기 완료:', response.data)
      return response.data
    } catch (error) {
      console.error('출퇴근 미리보기 실패:', error)
      error.value = error.response?.data?.message || error.message || '출퇴근 미리보기에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  // 새로운 QR 기반 출퇴근 API
  const qrAttendance = async (shopId, type, at, shiftId = null) => {
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const payload = {
        shopId,
        type,
        at
      }

      // shiftId가 있으면 페이로드에 추가 (퇴근시 사용)
      if (shiftId) {
        payload.shiftId = shiftId
      }

      const response = await api.post('/attendance', payload)

      console.log('QR 출퇴근 완료:', response.data)

      // 상태 업데이트
      if (type === 'IN') {
        currentStatus.value = {
          ...currentStatus.value,
          onDuty: true,
          clockInAt: response.data.clockInAt,
          shiftId: response.data.shiftId
        }
      } else if (type === 'OUT') {
        currentStatus.value = {
          ...currentStatus.value,
          onDuty: false,
          clockOutAt: at
        }
      }

      return response.data
    } catch (error) {
      console.error('QR 출퇴근 실패:', error)
      error.value = error.response?.data?.message || error.message || '출퇴근 처리에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }


  // 현재 사용자 관련 computed
  const isOnDuty = computed(() => currentStatus.value.onDuty)
  const canCheckIn = computed(() => !currentStatus.value.onDuty)
  const canCheckOut = computed(() => currentStatus.value.onDuty)
  
  const workingHours = computed(() => {
    if (!currentStatus.value.clockInAt) return null
    
    const totalMinutes = currentStatus.value.workedMinutes
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return `${hours}시간 ${minutes}분`
  })

  // ============= 관리자용 기능들 =============

  // Security validation
  const validateAdminPermission = () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      throw new Error('인증이 필요합니다. 다시 로그인해주세요.')
    }
    if (authStore.user?.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.')
    }
    return true
  }

  // Pagination state
  const nextCursor = ref(null)
  const hasMore = ref(true)

  // 관리자용 - 전체 직원 출퇴근 기록 조회
  const fetchRecords = async (startDate = null, endDate = null, cursor = null, reset = false) => {
    // Security validation
    validateAdminPermission()
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (cursor) params.cursor = cursor
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다.')
      }
      
      // Fetch attendance records
      const attendanceResponse = await api.get(`/admin/shops/${shopId}/attendance/records`, { params })
      
      // Handle new API response structure
      const apiData = attendanceResponse.data || {}
      const newRecords = apiData.items || []  // API returns "items", not "records"
      
      // Get employees from employees store 
      const employeesStore = useEmployeesStore()
      const employees = employeesStore.employees
      
      // Create employee lookup map for efficient joining
      const employeeMap = new Map()
      employees.forEach(emp => {
        employeeMap.set(emp.id, emp)
      })
      
      // Process records with enhanced data mapping including new API fields
      const processedRecords = newRecords.map(record => {
        const employee = employeeMap.get(record.employeeId) || {}
        
        return {
          // Core record fields
          id: record.id,
          shopId: record.shopId,
          employeeId: record.employeeId,
          type: record.type,
          clockInAt: record.clockInAt,
          clockOutAt: record.clockOutAt,
          
          // Time tracking fields
          workedMinutes: record.workedMinutes || 0,
          actualMinutes: record.actualMinutes || record.workedMinutes || 0, // New field
          extraMinutes: record.extraMinutes || 0,
          
          // Payment and status fields (new)
          finalPayAmount: record.finalPayAmount || 0, // New field for calculated pay
          status: record.status || (record.paired ? 'COMPLETED' : 'IN_PROGRESS'), // Enhanced status
          paired: record.paired || false,
          
          // Workshift integration (new)
          shiftId: record.shiftId || null, // New field linking to workshift
          
          // Additional metadata (new)
          memo: record.memo || null, // New field for notes
          
          // Enhanced employee data from joined employee info
          employeeName: employee.name || `직원 #${record.employeeId}`,
          employeePosition: employee.position || 'STAFF',
          employeeSection: employee.section || 'UNKNOWN',
          employeePersonalColor: employee.personalColor || null, // For UI styling
          
          // Additional computed fields
          date: record.clockInAt ? new Date(record.clockInAt).toDateString() : null,
          dateLocal: record.clockInAt ? new Date(record.clockInAt).toLocaleDateString('ko-KR') : null,
          
          // Computed status for legacy compatibility
          isCompleted: record.status === 'COMPLETED' || record.paired,
          isInProgress: record.status === 'IN_PROGRESS' || (!record.paired && record.clockInAt && !record.clockOutAt),
          
          // Time calculations
          totalMinutes: (record.actualMinutes || record.workedMinutes || 0) + (record.extraMinutes || 0),
          payRate: record.finalPayAmount && record.actualMinutes 
            ? Math.round(record.finalPayAmount / ((record.actualMinutes || record.workedMinutes) / 60))
            : null
        }
      })
      
      // Handle pagination
      if (reset || !cursor) {
        records.value = processedRecords
      } else {
        records.value = [...records.value, ...processedRecords]
      }
      
      // Update pagination state
      nextCursor.value = apiData.nextCursor || null
      hasMore.value = !!apiData.nextCursor
      isEmpty.value = records.value.length === 0
      
      console.log('전체 출퇴근 기록 조회 완료:', processedRecords.length, '건 (전체:', records.value.length, '건)')
      console.log('Pagination - nextCursor:', nextCursor.value, 'hasMore:', hasMore.value)
      return records.value
    } catch (error) {
      console.error('전체 출퇴근 기록 조회 실패:', error)
      
      // 404 에러와 데이터 없음을 구분하여 처리
      if (error.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리 (에러로 표시하지 않음)
        records.value = []
        error.value = null
        isEmpty.value = true
        console.log('출퇴근 기록이 없습니다 (404)')
        return []
      } else if (error.response?.status === 401) {
        // 인증 오류
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (error.response?.status === 403) {
        // 권한 오류
        error.value = '접근 권한이 없습니다.'
      } else if (error.response?.status >= 500) {
        // 서버 오류
        error.value = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else {
        // 기타 오류
        error.value = error.response?.data?.message || error.message || '출퇴근 기록을 불러오는데 실패했습니다'
      }
      
      throw error
    } finally {
      loading.value = false
    }
  }

  // Pagination functions
  const loadMoreRecords = async (startDate = null, endDate = null) => {
    if (!hasMore.value || loading.value) {
      console.log('더 불러올 데이터가 없거나 이미 로딩 중입니다.')
      return
    }
    
    try {
      await fetchRecords(startDate, endDate, nextCursor.value, false)
    } catch (error) {
      console.error('추가 데이터 로딩 실패:', error)
      throw error
    }
  }

  const resetRecords = () => {
    records.value = []
    nextCursor.value = null
    hasMore.value = true
    isEmpty.value = false
  }

  // 대시보드 관련 Actions
  const fetchTodaySummary = async () => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }

      const response = await api.get(`/admin/shops/${shopId}/dashboard/today`)
      todaySummary.value = response.data || {
        totalEmployees: 0,
        checkedIn: 0,
        late: 0,
        absent: 0
      }
      
      console.log('오늘 현황 조회 완료:', todaySummary.value)
      return todaySummary.value
    } catch (error) {
      console.error('오늘 현황 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '오늘 현황을 불러오는데 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchActiveEmployees = async () => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }

      const response = await api.get(`/admin/shops/${shopId}/dashboard/active`)
      activeEmployees.value = response.data || []
      
      console.log('실시간 근무자 조회 완료:', activeEmployees.value.length, '명')
      return activeEmployees.value
    } catch (error) {
      console.error('실시간 근무자 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '실시간 근무자 정보를 불러오는데 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchRecentActivities = async () => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }

      const response = await api.get(`/admin/shops/${shopId}/dashboard/recent`)
      recentActivities.value = response.data || []
      
      console.log('최근 활동 조회 완료:', recentActivities.value.length, '건')
      return recentActivities.value
    } catch (error) {
      console.error('최근 활동 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '최근 활동을 불러오는데 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }
  
  // 대시보드 전체 데이터 조회 (관리자용)
  const fetchDashboardData = async () => {
    try {
      await Promise.all([
        fetchTodaySummary(),
        fetchActiveEmployees(),
        fetchRecentActivities()
      ])
    } catch (error) {
      console.error('대시보드 데이터 조회 실패:', error)
      throw error
    }
  }

  // 직원용 데이터 초기화
  const initializeEmployeeData = async () => {
    try {
      // 오늘의 근무 일정 조회
      await fetchTodayWorkshifts()
    } catch (error) {
      console.error('직원 데이터 초기화 실패:', error)
      throw error
    }
  }

  // ============= 공통 기능들 =============

  // Getters - 관리자용 (기존 로직 유지)
  const getTodayRecord = computed(() => {
    return (employeeId) => {
      const today = new Date().toDateString()
      return records.value.find(record => 
        record.employeeId === employeeId && 
        new Date(record.date || record.clockInAt).toDateString() === today
      )
    }
  })

  const getTodayRecords = computed(() => {
    const today = new Date().toDateString()
    return records.value.filter(record => 
      new Date(record.date || record.clockInAt).toDateString() === today
    )
  })

  const getRecordsByDate = computed(() => {
    return (date) => {
      const targetDate = new Date(date).toDateString()
      return records.value.filter(record => 
        new Date(record.date || record.clockInAt).toDateString() === targetDate
      )
    }
  })

  const getRecordsByEmployee = computed(() => {
    return (employeeId) => {
      return records.value.filter(record => record.employeeId === employeeId)
    }
  })

  // 직원용 Getters
  const getEmployeeRecordsByDate = computed(() => {
    return (date) => {
      // 로컬 시간대 기준으로 날짜 문자열 생성 (시간대 차이 보정)
      const formatDateLocal = (dateInput) => {
        const d = new Date(dateInput)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      const targetDateStr = formatDateLocal(date)
      
      return employeeRecords.value.filter(record => {
        const recordDateStr = record.date || formatDateLocal(record.clockInAt)
        return recordDateStr === targetDateStr
      })
    }
  })

  const checkIn = async (shopId, shiftId, memo = null) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const requestData = {
        shopId,
        shiftId,
        type: 'IN'
      }
      
      // Add memo if provided
      if (memo) {
        requestData.memo = memo
      }
      
      const response = await api.post('/attendance', requestData)
      
      const record = response.data
      console.log('출근 처리 완료:', record)
      
      
      return record
    } catch (error) {
      console.error('출근 처리 실패:', error)
      const errorMessage = error.response?.data?.message || error.message || '출근 처리에 실패했습니다'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const checkOut = async (shopId, shiftId, memo = null) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const requestData = {
        shopId,
        shiftId,
        type: 'OUT'
      }
      
      // Add memo if provided
      if (memo) {
        requestData.memo = memo
      }
      
      const response = await api.post('/attendance', requestData)
      
      const record = response.data
      console.log('퇴근 처리 완료:', record)
      
      
      return record
    } catch (error) {
      console.error('퇴근 처리 실패:', error)
      const errorMessage = error.response?.data?.message || error.message || '퇴근 처리에 실패했습니다'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const processQRScan = async (shiftId = null) => {
    try {
      // 매장 ID 가져오기
      const shopId = getShopId()
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
      }
      
      
      if (!currentStatus.value.onDuty) {
        // 출근 처리 - shiftId가 필요함
        if (!shiftId) {
          throw new Error('출근할 근무를 선택해주세요.')
        }
        const record = await checkIn(parseInt(shopId), shiftId)
        return { action: 'check-in', shopId, shiftId, record }
      } else {
        // 퇴근 처리 - shiftId가 필요함
        if (!shiftId) {
          throw new Error('퇴근할 근무를 선택해주세요.')
        }
        const record = await checkOut(parseInt(shopId), shiftId)
        return { action: 'check-out', shopId, shiftId, record }
      }
    } catch (error) {
      console.error('QR 처리 실패:', error)
      throw error
    }
  }

  // 관리자용 수동 출퇴근 처리
  const manualAttendance = async (employeeId, type) => {
    validateAdminPermission()
    loading.value = true
    error.value = null
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다.')
      }

      if (!employeeId || !['IN', 'OUT'].includes(type)) {
        throw new Error('잘못된 매개변수입니다.')
      }

      // 현재 시간을 ISO 문자열로 생성
      const currentTime = new Date().toISOString()
      
      // 새로운 API 페이로드 형식: timestamp format
      const payload = type === 'IN' 
        ? { clockInAt: currentTime }
        : { clockOutAt: currentTime }

      // 새로운 관리자용 수동 출퇴근 API 호출
      try {
        await api.post(`/attendance/admin/shops/${shopId}/attendance/employees/${employeeId}`, payload)
      } catch (apiError) {
        if (apiError.response?.status === 404) {
          console.warn('수동 출퇴근 API 요청 실패')
        } else {
          throw apiError
        }
      }

      // 대시보드 데이터 새로고침
      await fetchDashboardData()
      
      console.log(`관리자 수동 ${type === 'IN' ? '출근' : '퇴근'} 처리 완료 - 직원 ID: ${employeeId}`)
      return true
    } catch (error) {
      console.error(`관리자 수동 ${type === 'IN' ? '출근' : '퇴근'} 처리 실패:`, error)
      error.value = error.response?.data?.message || error.message || `${type === 'IN' ? '출근' : '퇴근'} 처리에 실패했습니다`
      throw error
    } finally {
      loading.value = false
    }
  }

  // 관리자용 출퇴근 기록 수정
  const editAttendanceRecord = async (recordId, updateData) => {
    validateAdminPermission()
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다.')
      }

      if (!recordId) {
        throw new Error('출퇴근 기록 ID가 필요합니다.')
      }

      // API 호출
      const response = await api.put(`/attendance/admin/shops/${shopId}/attendance/records/${recordId}`, updateData)
      
      // 로컬 상태 업데이트
      const updatedRecord = response.data
      const recordIndex = records.value.findIndex(record => record.id === recordId)
      if (recordIndex !== -1) {
        records.value[recordIndex] = {
          ...records.value[recordIndex],
          ...updatedRecord,
          clockInAt: updatedRecord.clockInAt,
          clockOutAt: updatedRecord.clockOutAt
        }
      }

      // 대시보드 데이터 새로고침
      await fetchDashboardData()
      
      console.log('출퇴근 기록 수정 완료 - 기록 ID:', recordId)
      return updatedRecord
    } catch (error) {
      console.error('출퇴근 기록 수정 실패:', error)
      error.value = error.response?.data?.message || error.message || '출퇴근 기록 수정에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  // 특정 직원의 기록 삭제 (직원 삭제 시 사용)
  const deleteRecordsByEmployee = (employeeId) => {
    records.value = records.value.filter(record => record.employeeId !== employeeId)
    employeeRecords.value = employeeRecords.value.filter(record => record.employeeId !== employeeId)
  }

  // 통계 계산 - 직원용 (employeeRecords 사용)
  const getEmployeeStatistics = (startDate = null, endDate = null) => {
    let filteredRecords = employeeRecords.value
    
    if (startDate) {
      filteredRecords = filteredRecords.filter(record => 
        new Date(record.date || record.clockInAt) >= new Date(startDate)
      )
    }
    
    if (endDate) {
      filteredRecords = filteredRecords.filter(record => 
        new Date(record.date || record.clockInAt) <= new Date(endDate)
      )
    }
    
    const totalRecords = filteredRecords.length
    const completedRecords = filteredRecords.filter(record => 
      record.clockInAt && record.clockOutAt
    ).length
    const incompleteRecords = totalRecords - completedRecords
    
    return {
      total: totalRecords,
      completed: completedRecords,
      incomplete: incompleteRecords,
      completionRate: totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0
    }
  }

  // 관리자용 통계 계산 (enhanced with new fields)
  const getStatistics = (startDate = null, endDate = null) => {
    let filteredRecords = records.value
    
    if (startDate) {
      filteredRecords = filteredRecords.filter(record => 
        new Date(record.date || record.clockInAt) >= new Date(startDate)
      )
    }
    
    if (endDate) {
      filteredRecords = filteredRecords.filter(record => 
        new Date(record.date || record.clockInAt) <= new Date(endDate)
      )
    }
    
    const totalRecords = filteredRecords.length
    const completedRecords = filteredRecords.filter(record => 
      record.isCompleted || (record.clockInAt && record.clockOutAt)
    ).length
    const inProgressRecords = filteredRecords.filter(record => 
      record.isInProgress || (!record.clockOutAt && record.clockInAt)
    ).length
    
    // Enhanced statistics with new fields
    const totalWorkedMinutes = filteredRecords.reduce((sum, record) => 
      sum + (record.actualMinutes || record.workedMinutes || 0), 0
    )
    const totalExtraMinutes = filteredRecords.reduce((sum, record) => 
      sum + (record.extraMinutes || 0), 0
    )
    const totalPayAmount = filteredRecords.reduce((sum, record) => 
      sum + (record.finalPayAmount || 0), 0
    )
    
    return {
      total: totalRecords,
      completed: completedRecords,
      inProgress: inProgressRecords,
      incomplete: totalRecords - completedRecords - inProgressRecords,
      completionRate: totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0,
      // Enhanced metrics
      totalWorkedHours: Math.round(totalWorkedMinutes / 60 * 10) / 10,
      totalExtraHours: Math.round(totalExtraMinutes / 60 * 10) / 10,
      totalPayAmount,
      averagePayRate: totalWorkedMinutes > 0 ? Math.round(totalPayAmount / (totalWorkedMinutes / 60)) : 0,
      recordsWithMemo: filteredRecords.filter(record => record.memo).length
    }
  }

  // 근무 시간 계산 헬퍼 함수 (enhanced)
  const calculateWorkedTime = (clockInAt, clockOutAt, actualMinutes = null) => {
    if (!clockInAt || !clockOutAt) return null
    
    const start = new Date(clockInAt)
    const end = new Date(clockOutAt)
    const diffMs = end.getTime() - start.getTime()
    const calculatedMinutes = Math.floor(diffMs / (1000 * 60))
    
    // Use actual minutes from API if available, otherwise calculate
    const finalMinutes = actualMinutes || calculatedMinutes
    
    return {
      minutes: finalMinutes,
      calculatedMinutes, // Raw calculation for comparison
      hours: Math.floor(finalMinutes / 60),
      displayTime: `${Math.floor(finalMinutes / 60)}시간 ${finalMinutes % 60}분`,
      // Additional formatting options
      shortDisplay: `${Math.floor(finalMinutes / 60)}:${String(finalMinutes % 60).padStart(2, '0')}`,
      decimalHours: Math.round(finalMinutes / 60 * 100) / 100
    }
  }
  
  // Helper function for pay calculation
  const calculatePayAmount = (minutes, hourlyRate, extraMinutes = 0, overtimeRate = 1.5) => {
    if (!minutes || !hourlyRate) return 0
    
    const regularPay = (minutes / 60) * hourlyRate
    const overtimePay = extraMinutes > 0 ? (extraMinutes / 60) * hourlyRate * overtimeRate : 0
    
    return Math.round(regularPay + overtimePay)
  }
  
  // Helper function for status formatting
  const formatAttendanceStatus = (status, paired = false, clockInAt = null, clockOutAt = null) => {
    const statusMap = {
      'COMPLETED': '완료',
      'IN_PROGRESS': '근무중',
      'CANCELLED': '취소',
      'PENDING': '대기중'
    }
    
    // Legacy compatibility
    if (!status) {
      if (paired || (clockInAt && clockOutAt)) return '완료'
      if (clockInAt && !clockOutAt) return '근무중'
      return '미처리'
    }
    
    return statusMap[status] || status
  }

  return {
    // State
    records, // 관리자용
    employeeRecords, // 직원용
    todayWorkshifts, // 오늘의 근무 일정
    todaySummary,
    activeEmployees,
    recentActivities,
    loading,
    error,
    isEmpty, // 데이터가 비어있는지 표시 (에러와 구분)
    currentStatus, // 직원의 현재 상태
    
    // Pagination State
    nextCursor,
    hasMore,
    
    // 직원용 Getters
    isOnDuty,
    canCheckIn,
    canCheckOut,
    workingHours,
    getEmployeeRecordsByDate,
    
    // 관리자용 Getters
    getTodayRecord,
    getTodayRecords,
    getRecordsByDate,
    getRecordsByEmployee,
    
    // 직원용 Actions
    fetchTodayWorkshifts,
    fetchMyOverview,
    attendancePreview,
    qrAttendance,
    initializeEmployeeData,
    getEmployeeStatistics,
    
    // 관리자용 Actions
    fetchRecords,
    loadMoreRecords,
    resetRecords,
    fetchTodaySummary,
    fetchActiveEmployees,
    fetchRecentActivities,
    fetchDashboardData,
    
    // 공통 Actions
    checkIn,
    checkOut,
    processQRScan,
    manualAttendance,
    editAttendanceRecord,
    deleteRecordsByEmployee,
    getStatistics,
    getApiInstance,
    
    // Helper functions
    calculateWorkedTime,
    calculatePayAmount,
    formatAttendanceStatus
  }
})