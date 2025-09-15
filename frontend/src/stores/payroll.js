import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const usePayrollStore = defineStore('payroll', () => {
  const loading = ref(false)
  const loadingDetail = ref(false)
  const error = ref(null)
  const payrollDashboard = ref({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    expectedExpense: 0,
    lastMonthExpense: 0,
    employeeCount: 0,
    totalWorkedMinutes: 0
  })
  
  const payrollOverview = ref(null)
  const employeePayrollList = ref(null)
  const employeeDetail = ref(null)
  const payrollSettings = ref({
    standardWorkHours: 8,
    overtimeRate: 1.5,
    lateDeduction: 5000,
    absentDeduction: 50000
  })

  const getApiInstance = () => {
    const authStore = useAuthStore()
    const apiInstance = authStore.getApiInstance()
    
    if (!apiInstance) {
      throw new Error('API 인스턴스를 가져올 수 없습니다. 인증 상태를 확인하세요.')
    }
    
    return apiInstance
  }

  const getShopId = () => {
    const authStore = useAuthStore()
    const shopId = authStore.user?.shopId
    
    if (!shopId) {
      throw new Error('매장 ID를 찾을 수 없습니다. 사용자 권한을 확인하세요.')
    }

    if (!Number.isInteger(Number(shopId)) || Number(shopId) <= 0) {
      throw new Error('유효하지 않은 매장 ID입니다.')
    }
    
    return shopId
  }
  
  const validateAdminPermission = () => {
    const authStore = useAuthStore()
    
    if (!authStore.isAuthenticated) {
      throw new Error('인증이 필요합니다.')
    }
    
    if (authStore.user?.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.')
    }
    
    return true
  }
  
  const validateDateParams = (year, month) => {
    if (year && (!Number.isInteger(year) || year < 2020 || year > 2030)) {
      throw new Error('유효하지 않은 연도입니다.')
    }
    
    if (month && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new Error('유효하지 않은 월입니다.')
    }
    
    return true
  }

  const requestCache = ref(new Map())
  const activeRequests = ref(new Set())

  // 캐시 무효화 함수
  const invalidateCache = (pattern = null) => {
    if (pattern) {
      // 특정 패턴과 일치하는 캐시만 삭제
      for (const [key] of requestCache.value) {
        if (key.includes(pattern)) {
          requestCache.value.delete(key)
        }
      }
    } else {
      // 전체 캐시 삭제
      requestCache.value.clear()
    }
    console.log(`💧 캐시 무효화 완료: ${pattern || '전체'}`)
  }

  const fetchEmployeePayrollList = async (year = null, month = null) => {
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    const requestKey = `employee_list_${targetYear}_${targetMonth}`
    
    if (activeRequests.value.has(requestKey)) {
      console.log('동일한 직원 급여 목록 요청이 진행 중, 대기...')
      return
    }
    
    const cached = requestCache.value.get(requestKey)
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      console.log('💾 캐시된 직원 급여 목록 데이터 사용')
      employeePayrollList.value = cached.data
      return cached.data
    }
    
    activeRequests.value.add(requestKey)
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/employees`, {
        params: { year: targetYear, month: targetMonth }
      })
      
      const listData = response.data
      employeePayrollList.value = listData
      
      requestCache.value.set(requestKey, {
        data: listData,
        timestamp: Date.now()
      })

      console.log('직원 급여 목록 조회 완료:', listData)
      return listData
    } catch (err) {
      console.error('직원 급여 목록 조회 실패:', err)
      
      if (err.response?.status === 404) {
        employeePayrollList.value = {
          year: targetYear,
          month: targetMonth,
          cycle: null,
          summary: { employeeCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0 },
          items: []
        }
        error.value = null
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else {
        error.value = err.response?.data?.message || err.message || '직원 급여 목록을 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loading.value = false
      activeRequests.value.delete(requestKey)
    }
  }


  const fetchEmployeePayrollDetail = async (employeeId, year = null, month = null) => {
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    if (!employeeId || !Number.isInteger(Number(employeeId))) {
      throw new Error('유효하지 않은 직원 ID입니다.')
    }
    
    loadingDetail.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/employees/${employeeId}`, {
        params: { year: targetYear, month: targetMonth }
      })
      
      const detailData = response.data
      employeeDetail.value = detailData

      console.log('직원 급여 상세 조회 완료:', detailData)
      return detailData
    } catch (err) {
      console.error('직원 급여 상세 조회 실패:', err)
      
      if (err.response?.status === 404) {
        error.value = '해당 직원의 급여 정보를 찾을 수 없습니다.'
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else {
        error.value = err.response?.data?.message || err.message || '직원 급여 상세 정보를 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loadingDetail.value = false
    }
  }

  const processEmployeeSettlement = async (employeeId, year, month) => {
  validateAdminPermission();

  if (!employeeId || isNaN(Number(employeeId))) {
    throw new Error('유효하지 않은 직원 ID입니다.');
  }

  if (!year || isNaN(Number(year))) {
    throw new Error('유효하지 않은 연도입니다.');
  }

  if (!month || isNaN(Number(month)) || month < 1 || month > 12) {
    throw new Error('유효하지 않은 월입니다.');
  }

  loading.value = true;
  error.value = null;

  try {
    const api = getApiInstance();
    const shopId = getShopId();

    if (!shopId || isNaN(Number(shopId))) {
      throw new Error('유효하지 않은 shopId입니다.');
    }

    const payload = {
      year: year,
      month: month
    }

    const response = await api.post(`/admin/shops/${shopId}/payroll/employees/${employeeId}`, payload);

    const settlementResult = response.data;
    console.log('직원 정산 처리 완료:', settlementResult);

    // 정산 완료 후 관련 캐시 무효화
    invalidateCache(`${year}_${month}`);

    return settlementResult;
  } catch (err) {
    console.error('직원 정산 처리 실패:', err.response?.data || err);

    if (err.response?.status === 404) {
      error.value = '해당 직원을 찾을 수 없습니다.';
    } else if (err.response?.status === 400) {
      error.value = err.response?.data?.message || '정산 처리할 수 없습니다.';
    } else if (err.response?.status === 401) {
      error.value = '인증에 실패했습니다. 다시 로그인해주세요.';
    } else if (err.response?.status === 403) {
      error.value = '정산 처리 권한이 없습니다.';
    } else {
      error.value = err.response?.data?.message || err.message || '정산 처리에 실패했습니다';
    }
    throw err;
  } finally {
    loading.value = false;
  }
};

  const exportPayrollExcel = async (year = null, month = null, cycleStartDay = null) => {
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const params = { 
        year: targetYear, 
        month: targetMonth
      }
      
      if (cycleStartDay && cycleStartDay !== 1 && cycleStartDay >= 1 && cycleStartDay <= 31) {
        params.cycleStartDay = cycleStartDay
      }
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/export-xlsx`, { 
        params,
        responseType: 'blob' // XLSX binary stream을 위한 설정
      })
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `급여명세서_${targetYear}년${targetMonth}월.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      console.log(`급여 엑셀 다운로드 완료: ${targetYear}년 ${targetMonth}월`)
      return { success: true, message: '엑셀 파일이 다운로드되었습니다.' }
    } catch (err) {
      console.error('급여 엑셀 다운로드 실패:', err)
      
      if (err.response?.status === 404) {
        error.value = '다운로드할 급여 데이터가 없습니다.'
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '엑셀 다운로드 권한이 없습니다.'
      } else {
        error.value = err.response?.data?.message || err.message || '엑셀 다운로드에 실패했습니다.'
      }
      throw err
    } finally {
      loading.value = false
    }
  }


  const fetchPayrollOverview = async (year = null, month = null, cycleStartDay = null) => {
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    const requestKey = `overview_${targetYear}_${targetMonth}_${cycleStartDay || 'default'}`
    if (activeRequests.value.has(requestKey)) {
      console.log('동일한 급여 개요 요청이 진행 중, 대기...')
      return
    }
    
    const cached = requestCache.value.get(requestKey)
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      console.log('💾 캐시된 급여 개요 데이터 사용')
      return cached.data
    }
    
    activeRequests.value.add(requestKey)
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const params = { 
        year: targetYear, 
        month: targetMonth 
      }
      if (cycleStartDay && cycleStartDay !== 1 && cycleStartDay >= 1 && cycleStartDay <= 31) {
        params.cycleStartDay = cycleStartDay
      }
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/overview`, { params })
      
      const overviewData = response.data || {
        year: targetYear,
        month: targetMonth,
        cycle: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
          label: `${targetMonth}월 급여`,
          startDay: 1
        },
        fixed: {
          amount: 0,
          withholding3_3: 0,
          netAmount: 0
        },
        hourly: {
          amount: 0,
          shiftCount: 0,
          withholding3_3: 0,
          netAmount: 0
        },
        totals: {
          expectedPayout: 0,
          previousExpectedPayout: 0,
          deltaFromPrev: 0,
          expectedPayoutNet: 0,
          previousExpectedPayoutNet: 0,
          deltaFromPrevNet: 0,
          withholding3_3: {
            current: 0,
            previous: 0,
            rate: 0.033
          }
        },
        meta: {
          eligibleEmployees: 0
        }
      }
      
      payrollOverview.value = overviewData
      payrollDashboard.value = {
        ...payrollDashboard.value,
        year: overviewData.year,
        month: overviewData.month,
        expectedExpense: overviewData.totals.expectedPayout,
        lastMonthExpense: overviewData.totals.previousExpectedPayout,
        employeeCount: overviewData.meta.eligibleEmployees,
        totalWorkedMinutes: overviewData.hourly.shiftCount * 480 // 추정값
      }
      
      requestCache.value.set(requestKey, {
        data: overviewData,
        timestamp: Date.now()
      })

      console.log('급여 개요 조회 완료:', overviewData)
      return overviewData
    } catch (err) {
      console.error('급여 개요 조회 실패:', err)
      
      if (err.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리
        const defaultData = {
          year: targetYear,
          month: targetMonth,
          cycle: {
            start: new Date().toISOString(),
            end: new Date().toISOString(), 
            label: `${targetMonth}월 급여`,
            startDay: cycleStartDay || 1
          },
          fixed: { amount: 0, withholding3_3: 0, netAmount: 0 },
          hourly: { amount: 0, shiftCount: 0, withholding3_3: 0, netAmount: 0 },
          totals: {
            expectedPayout: 0,
            previousExpectedPayout: 0,
            deltaFromPrev: 0,
            expectedPayoutNet: 0,
            previousExpectedPayoutNet: 0,
            deltaFromPrevNet: 0,
            withholding3_3: { current: 0, previous: 0, rate: 0.033 }
          },
          meta: { eligibleEmployees: 0 }
        }
        // 404 에러의 경우도 payrollOverview state에 기본 데이터 설정
        payrollOverview.value = defaultData
        error.value = null
        return defaultData
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else if (err.response?.status >= 500) {
        error.value = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else {
        error.value = err.response?.data?.message || err.message || '급여 개요 데이터를 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loading.value = false
      activeRequests.value.delete(requestKey)
    }
  }

  const formatWorkDuration = (minutes) => {
    if (!minutes || minutes === 0) return '0시간 0분'
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    return `${hours}시간 ${remainingMinutes}분`
  }

  const formatSalary = (amount) => {
    if (!amount) return '0원'
    return `${amount.toLocaleString()}원`
  }

  const processBulkSettlement = async (year = null, month = null) => {
    validateAdminPermission()

    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)

    validateDateParams(targetYear, targetMonth)

    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()

      const response = await api.post(`/admin/shops/${shopId}/payroll/settlements`, {
        year: targetYear,
        month: targetMonth,
        cycleStartDay: 1
      })

      const result = response.data
      console.log('대량 정산 처리 완료:', result)

      // 캐시 무효화 후 데이터 새로고침
      invalidateCache()
      await fetchEmployeePayrollList(targetYear, targetMonth)
      await fetchPayrollOverview(targetYear, targetMonth)

      return result
    } catch (err) {
      console.error('대량 정산 처리 실패:', err)

      if (err.response?.status === 404) {
        error.value = '정산할 급여 정보를 찾을 수 없습니다.'
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '정산 처리 권한이 없습니다.'
      } else if (err.response?.status === 400) {
        error.value = err.response.data?.message || '잘못된 요청입니다.'
      } else {
        error.value = '정산 처리 중 오류가 발생했습니다.'
      }

      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,
    payrollDashboard,
    payrollOverview,
    payrollSettings,
    employeePayrollList,
    employeeDetail,
    requestCache,

    // Actions
    fetchPayrollOverview,
    fetchEmployeePayrollList,
    fetchEmployeePayrollDetail,
    processEmployeeSettlement,
    processBulkSettlement,
    exportPayrollExcel,
    invalidateCache,

    getApiInstance,
    getShopId,

    // Utilities
    formatWorkDuration,
    formatSalary
  }
})