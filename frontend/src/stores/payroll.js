import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const usePayrollStore = defineStore('payroll', () => {
  // State
  const loading = ref(false)
  const error = ref(null)
  
  // 급여 대시보드 데이터
  const payrollDashboard = ref({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    expectedExpense: 0,
    lastMonthExpense: 0,
    employeeCount: 0,
    totalWorkedMinutes: 0
  })
  
  // 직원별 급여 목록
  const employeePayrolls = ref([])
  
  // 특정 직원 상세 정보
  const employeeDetail = ref(null)

  // 정산 관련 데이터
  const settlements = ref([])

  const payrollSettings = ref({
    standardWorkHours: 8,
    overtimeRate: 1.5,
    lateDeduction: 5000,
    absentDeduction: 50000
  })

  // API 인스턴스 가져오기 (보안 강화)
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
    
    // 숫자형 shopId 검증
    if (!Number.isInteger(Number(shopId)) || Number(shopId) <= 0) {
      throw new Error('유효하지 않은 매장 ID입니다.')
    }
    
    return shopId
  }
  
  // 보안 검증 함수
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
  
  // 입력 데이터 검증
  const validateDateParams = (year, month) => {
    if (year && (!Number.isInteger(year) || year < 2020 || year > 2030)) {
      throw new Error('유효하지 않은 연도입니다.')
    }
    
    if (month && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new Error('유효하지 않은 월입니다.')
    }
    
    return true
  }

  // Helper functions for API data processing would go here if needed

  // 요청 캐시 및 중복 방지
  const requestCache = ref(new Map())
  const activeRequests = ref(new Set())

  // Actions - 실제 API 연동
  const fetchPayrollDashboard = async (year = null, month = null) => {
    // 🛡️ 보안 검증
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    const requestKey = `dashboard_${targetYear}_${targetMonth}`
    
    // 이미 동일한 요청이 진행 중이면 대기
    if (activeRequests.value.has(requestKey)) {
      console.log('⚠️ 동일한 대시보드 요청이 진행 중, 대기...')
      return
    }
    
    // 캐시된 데이터가 있고 5분 이내면 재사용
    const cached = requestCache.value.get(requestKey)
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      console.log('💾 캐시된 대시보드 데이터 사용')
      payrollDashboard.value = cached.data
      return
    }
    
    if (loading.value) return // 이미 로딩 중이면 중복 요청 방지
    
    activeRequests.value.add(requestKey)
    
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)
      
      const params = { year: targetYear, month: targetMonth }
      const response = await api.get(`/admin/shops/${shopId}/payroll/dashboard`, { params })
      
      payrollDashboard.value = response.data || {
        year: targetYear,
        month: targetMonth,
        expectedExpense: 0,
        lastMonthExpense: 0,
        employeeCount: 0,
        totalWorkedMinutes: 0
      }
      
      // 캐시에 저장
      requestCache.value.set(requestKey, {
        data: payrollDashboard.value,
        timestamp: Date.now()
      })

      console.log('급여 대시보드 조회 완료:', payrollDashboard.value)
    } catch (err) {
      console.error('급여 대시보드 조회 실패:', err)
      
      if (err.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리
        payrollDashboard.value = {
          year: year || new Date().getFullYear(),
          month: month || (new Date().getMonth() + 1),
          expectedExpense: 0,
          lastMonthExpense: 0,
          employeeCount: 0,
          totalWorkedMinutes: 0
        }
        error.value = null
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else if (err.response?.status >= 500) {
        error.value = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else {
        error.value = err.response?.data?.message || err.message || '급여 대시보드 데이터를 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loading.value = false
      activeRequests.value.delete(requestKey)
    }
  }

  const fetchEmployeePayrolls = async (year = null, month = null) => {
    // 🛡️ 보안 검증
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    if (loading.value) return // 중복 요청 방지
    
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)
      
      const params = { year: targetYear, month: targetMonth }
      const response = await api.get(`/admin/shops/${shopId}/payroll/employees`, { params })
      
      // 🔧 새로운 API 응답 구조 처리
      if (response.data && Array.isArray(response.data.employees)) {
        // 새 API 구조를 기존 컴포넌트가 기대하는 구조로 변환
        employeePayrolls.value = response.data.employees.map(emp => ({
          ...emp,
          // 기존 settlement 객체 구조로 변환
          settlement: {
            status: emp.settlementStatus || 'PENDING',
            settlementId: null, // 새 API에는 없음
            totalPay: emp.settlementTotalPay || null,
            settledAt: emp.settledAt || null,
            fullyApplied: true
          },
          // 호환성을 위한 필드 매핑
          salary: emp.expectedSalary || emp.salary || 0
        }))
        
        // payrollDashboard도 새 API 응답의 summary 정보로 업데이트
        if (response.data.summary) {
          payrollDashboard.value = {
            ...payrollDashboard.value,
            year: response.data.year || targetYear,
            month: response.data.month || targetMonth,
            expectedExpense: response.data.employees.reduce((sum, emp) => sum + (emp.salary || 0), 0),
            employeeCount: response.data.summary.employeeCount || response.data.employees.length,
            totalWorkedMinutes: response.data.summary.totalWorkedMinutes || 0
          }
        }
        
        console.log('📊 직원 급여 목록 조회 완료:', response.data.employees.length, '건')
        console.log('📅 정산 기간:', response.data.cycle?.label || 'N/A')
        console.log('📈 요약:', response.data.summary)
      } else {
        employeePayrolls.value = []
        console.warn('⚠️ 직원 급여 데이터 형식이 예상과 다름:', response.data)
      }
    } catch (err) {
      console.error('직원 급여 목록 조회 실패:', err)
      
      if (err.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리
        employeePayrolls.value = []
        error.value = null
        console.log('📭 급여 데이터 없음 (404) - 빈 배열로 처리')
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else if (err.response?.status >= 500) {
        error.value = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else {
        error.value = err.response?.data?.message || err.message || '직원 급여 목록을 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchEmployeePayrollDetail = async (employeeId, year = null, month = null) => {
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)
      
      const params = { year: targetYear, month: targetMonth }
      const response = await api.get(`/admin/shops/${shopId}/payroll/employees/${employeeId}`, { params })
      
      // API 응답을 그대로 저장 (간단하게!)
      employeeDetail.value = response.data
      
      console.log('직원 급여 상세 조회 완료:', employeeDetail.value)
      return employeeDetail.value
    } catch (err) {
      console.error('직원 급여 상세 조회 실패:', err)
      error.value = err.response?.data?.message || err.message || '직원 정보를 불러오는데 실패했습니다'
      employeeDetail.value = null
      throw err
    } finally {
      loading.value = false
    }
  }

  // 엑셀 다운로드 기능 추가
  const exportPayrollExcel = async (year = null, month = null, format = 'xlsx') => {
    // 🛡️ 보안 검증
    validateAdminPermission()
    
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    validateDateParams(targetYear, targetMonth)
    
    // format 검증
    if (!['xlsx', 'csv'].includes(format)) {
      throw new Error('지원하지 않는 파일 형식입니다.')
    }
    
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)
      
      const params = { 
        year: targetYear, 
        month: targetMonth,
        format: format // xlsx, csv 등
      }
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/export`, { 
        params,
        responseType: 'blob' // 파일 다운로드를 위한 설정
      })
      
      // 브라우저에서 파일 다운로드 처리
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
      
      console.log(`✅ 급여 엑셀 다운로드 완료: ${targetYear}년 ${targetMonth}월`)
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

  const fetchSettlements = async () => {
    loading.value = true
    error.value = null

    try {
      // Mock 정산 목록
      settlements.value = [
        {
          id: 1,
          period: '2025년 1월 7일 ~ 2025년 2월 6일',
          totalAmount: 12500000,
          employeeCount: 8,
          status: 'completed',
          settlementDate: '2025-02-07',
          processedBy: '관리자'
        },
        {
          id: 2,
          period: '2025년 2월 7일 ~ 2025년 3월 6일',
          totalAmount: 13200000,
          employeeCount: 9,
          status: 'pending',
          settlementDate: null,
          processedBy: null
        }
      ]
    } catch (err) {
      error.value = err.message || '정산 목록을 불러오는데 실패했습니다'
      console.error('정산 목록 오류:', err)
    } finally {
      loading.value = false
    }
  }

  const getEmployeeSettlement = async (employeeId) => {
    if (loading.value) return null // 이미 로딩 중이면 중복 요청 방지
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const response = await api.get(`/admin/shops/${shopId}/payroll/settlement/${employeeId}`)
      
      return response.data || {
        currentPeriod: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          amount: 0,
          settled: false,
          daysWorked: 0,
          workedMinutes: 0
        },
        lastSettlement: {
          amount: 0,
          settlementDate: new Date().toISOString(),
          settled: true
        }
      }
    } catch (err) {
      console.error('정산 정보 조회 실패:', err)
      
      if (err.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리
        return {
          currentPeriod: {
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            amount: 0,
            settled: false,
            daysWorked: 0,
            workedMinutes: 0
          },
          lastSettlement: {
            amount: 0,
            settlementDate: new Date().toISOString(),
            settled: true
          }
        }
      }
      
      error.value = err.response?.data?.message || err.message || '정산 정보를 불러오는데 실패했습니다'
      throw err
    }
  }

  // 직원별 급여 요약 (summary API)
  const fetchEmployeePayrollSummary = async (employeeId, year = null, month = null) => {
    loading.value = true
    error.value = null

    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)
      
      const params = { year: targetYear, month: targetMonth }
      const response = await api.get(`/admin/shops/${shopId}/payroll/employees/${employeeId}/summary`, { params })
      
      const summary = response.data || {
        employee: { name: '알 수 없음', position: '알 수 없음' },
        period: { year: targetYear, month: targetMonth },
        summary: {
          totalSalary: 0,
          baseSalary: 0,
          overtimePay: 0,
          deductions: 0,
          netSalary: 0,
          workingDays: 0,
          overtimeHours: 0
        },
        breakdown: {
          regularHours: 0,
          overtimeHours: 0,
          lateDeduction: 0,
          absentDeduction: 0
        }
      }
      
      console.log('직원 급여 요약 조회 완료:', summary)
      return summary
    } catch (err) {
      console.error('직원 급여 요약 조회 실패:', err)
      
      if (err.response?.status === 404) {
        // 404 에러는 데이터 없음으로 처리
        const summary = {
          employee: { name: '알 수 없음', position: '알 수 없음' },
          period: { year: year || new Date().getFullYear(), month: month || (new Date().getMonth() + 1) },
          summary: {
            totalSalary: 0,
            baseSalary: 0,
            overtimePay: 0,
            deductions: 0,
            netSalary: 0,
            workingDays: 0,
            overtimeHours: 0
          },
          breakdown: {
            regularHours: 0,
            overtimeHours: 0,
            lateDeduction: 0,
            absentDeduction: 0
          }
        }
        error.value = null
        return summary
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '접근 권한이 없습니다.'
      } else {
        error.value = err.response?.data?.message || err.message || '직원 급여 요약 정보를 불러오는데 실패했습니다'
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 개별 직원 정산 처리 (새 API 사용)
  const processEmployeeSettlement = async (employeeId, settlementData = {}) => {
    // 🛡️ 보안 검증
    validateAdminPermission()
    
    if (!employeeId) {
      throw new Error('직원 ID가 필요합니다.')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }
      
      // 새로운 관리자 정산 API 호출
      const response = await api.post(`/admin/shops/${shopId}/settlements/employees/${employeeId}`, settlementData)
      
      const result = response.data || {
        success: true,
        message: '정산이 완료되었습니다',
        employeeId: employeeId,
        settlementId: null,
        processedAmount: 0,
        processedAt: new Date().toISOString()
      }
      
      console.log(`✅ 직원 ${employeeId} 정산 처리 완료:`, result)
      return result
    } catch (err) {
      console.error(`직원 ${employeeId} 정산 처리 실패:`, err)
      
      if (err.response?.status === 404) {
        error.value = '해당 직원의 정산 정보를 찾을 수 없습니다.'
      } else if (err.response?.status === 401) {
        error.value = '인증에 실패했습니다. 다시 로그인해주세요.'
      } else if (err.response?.status === 403) {
        error.value = '정산 처리 권한이 없습니다.'
      } else if (err.response?.status === 400) {
        error.value = err.response?.data?.message || '잘못된 정산 요청입니다.'
      } else {
        error.value = err.response?.data?.message || err.message || '정산 처리에 실패했습니다'
      }
      
      throw err
    } finally {
      loading.value = false
    }
  }

  const processSettlement = async (settlementData) => {
    // 🛡️ 보안 검증
    validateAdminPermission()
    
    loading.value = true
    error.value = null
    
    try {
      if (!settlementData || !settlementData.employees || settlementData.employees.length === 0) {
        throw new Error('정산할 직원 정보가 없습니다.')
      }
      
      console.log('🔄 전체 정산 처리 시작:', settlementData)
      
      // 각 직원별로 개별 정산 처리
      const results = []
      const errors = []
      
      for (const employee of settlementData.employees) {
        try {
          const employeeSettlementData = {
            amount: employee.amount,
            workedMinutes: employee.workedMinutes,
            daysWorked: employee.daysWorked,
            period: settlementData.period,
            settlementDate: settlementData.startDate || new Date().toISOString()
          }
          
          const result = await processEmployeeSettlement(employee.employeeId, employeeSettlementData)
          results.push({
            employeeId: employee.employeeId,
            name: employee.name,
            amount: employee.amount,
            success: true,
            ...result
          })
        } catch (error) {
          console.error(`직원 ${employee.employeeId} 정산 실패:`, error)
          errors.push({
            employeeId: employee.employeeId,
            name: employee.name,
            error: error.message
          })
        }
      }
      
      // 전체 결과 정리
      const totalProcessedAmount = results.reduce((sum, r) => sum + (r.processedAmount || 0), 0)
      const successCount = results.length
      const failureCount = errors.length
      
      const finalResult = {
        success: successCount > 0,
        message: errors.length > 0 
          ? `${successCount}명 정산 완료, ${failureCount}명 실패`
          : `${successCount}명 정산 완료`,
        totalProcessedAmount,
        processedEmployees: successCount,
        failedEmployees: failureCount,
        results,
        errors,
        processedAt: new Date().toISOString(),
        processedBy: 'admin'
      }
      
      // 정산 목록 업데이트 (성공한 경우만)
      if (successCount > 0) {
        const newSettlement = {
          id: settlements.value.length + 1,
          period: settlementData.period || '현재 정산 기간',
          totalAmount: totalProcessedAmount,
          employeeCount: successCount,
          status: errors.length > 0 ? 'partial' : 'completed',
          settlementDate: new Date().toISOString().split('T')[0],
          processedBy: '관리자',
          errors: errors.length > 0 ? errors : null
        }
        
        settlements.value.unshift(newSettlement)
      }
      
      console.log('✅ 전체 정산 처리 완료:', finalResult)
      return finalResult
    } catch (err) {
      console.error('정산 처리 실패:', err)
      error.value = err.response?.data?.message || err.message || '정산 처리에 실패했습니다'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Utility functions
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

  // Getters
  const getAllEmployeeSalaries = computed(() => {
    return employeePayrolls.value.map(payroll => ({
      id: payroll.employeeId,
      name: payroll.name,
      position: payroll.position,
      hourlyRate: payroll.hourlyPay,
      monthlyPay: payroll.monthlyPay,
      totalHours: Math.round((payroll.workedMinutes + payroll.extraMinutes) / 60 * 10) / 10,
      workDays: payroll.daysWorked,
      lateDays: 0,
      absentDays: 0,
      overtimeDays: payroll.extraMinutes > 0 ? Math.ceil(payroll.extraMinutes / 480) : 0,
      overtimeHours: Math.round(payroll.extraMinutes / 60 * 10) / 10,
      baseSalary: payroll.salary - (payroll.hourlyPay ? (payroll.hourlyPay * payroll.extraMinutes / 60 * 1.5) : 0),
      overtimePay: payroll.hourlyPay ? (payroll.hourlyPay * payroll.extraMinutes / 60 * 1.5) : 0,
      lateDeduction: 0,
      absentDeduction: 0,
      totalSalary: payroll.salary,
      workingDaysInMonth: 22
    }))
  })

  const getTotalMonthlyCost = computed(() => {
    return payrollDashboard.value.expectedExpense || 0
  })

  return {
    // State
    loading,
    error,
    payrollDashboard,
    employeePayrolls,
    employeeDetail,
    payrollSettings,
    settlements,
    
    // Actions
    fetchPayrollDashboard,
    fetchEmployeePayrolls,
    fetchEmployeePayrollDetail,
    fetchEmployeePayrollSummary,
    exportPayrollExcel,
    fetchSettlements,
    getEmployeeSettlement,
    processSettlement,
    processEmployeeSettlement,
    
    // Getters
    getAllEmployeeSalaries,
    getTotalMonthlyCost,
    getApiInstance,
    getShopId,
    
    // Utilities
    formatWorkDuration,
    formatSalary
  }
})