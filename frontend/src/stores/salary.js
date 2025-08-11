import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useSalaryStore = defineStore('salary', () => {
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

  const salarySettings = ref({
    standardWorkHours: 8, // 하루 기본 근무시간
    overtimeRate: 1.5, // 야근 수당 배율
    lateDeduction: 5000, // 지각시 차감 금액
    absentDeduction: 50000 // 결근시 차감 금액
  })

  // Actions
  const fetchPayrollDashboard = async (year = null, month = null) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.user?.shopId) {
      throw new Error('인증되지 않은 사용자입니다')
    }

    loading.value = true
    error.value = null

    try {
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/shops/${authStore.user.shopId}/payroll/dashboard?year=${targetYear}&month=${targetMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('급여 대시보드 데이터를 불러오는데 실패했습니다')
      }

      const data = await response.json()
      payrollDashboard.value = data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchEmployeePayrolls = async (year = null, month = null) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.user?.shopId) {
      throw new Error('인증되지 않은 사용자입니다')
    }

    loading.value = true
    error.value = null

    try {
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/shops/${authStore.user.shopId}/payroll/employees?year=${targetYear}&month=${targetMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('직원 급여 목록을 불러오는데 실패했습니다')
      }

      const data = await response.json()
      employeePayrolls.value = data.employees || []
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchEmployeePayrollDetail = async (employeeId, year = null, month = null) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.user?.shopId) {
      throw new Error('인증되지 않은 사용자입니다')
    }

    loading.value = true
    error.value = null

    try {
      const currentDate = new Date()
      const targetYear = year || currentDate.getFullYear()
      const targetMonth = month || (currentDate.getMonth() + 1)

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/shops/${authStore.user.shopId}/payroll/employees/${employeeId}?year=${targetYear}&month=${targetMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${authStore.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('직원 급여 상세 정보를 불러오는데 실패했습니다')
      }

      const data = await response.json()
      employeeDetail.value = data
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Getters (기존 로직을 API 기반으로 마이그레이션)
  const getEmployeeMonthlyStats = computed(() => {
    return (employeeId) => {
      const employee = employeePayrolls.value.find(emp => emp.employeeId === employeeId)
      if (!employee) return null

      const regularHours = Math.floor(employee.workedMinutes / 60)
      const overtimeHours = Math.floor(employee.extraMinutes / 60)
      
      return {
        totalHours: Math.round((employee.workedMinutes + employee.extraMinutes) / 60 * 10) / 10,
        workDays: 0, // API에서 제공되지 않음
        lateDays: 0, // API에서 제공되지 않음
        absentDays: 0, // API에서 제공되지 않음
        overtimeDays: employee.extraMinutes > 0 ? 1 : 0,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        baseSalary: employee.salary - (employee.hourlyPay ? (employee.hourlyPay * overtimeHours * salarySettings.value.overtimeRate) : 0),
        overtimePay: employee.hourlyPay ? (employee.hourlyPay * overtimeHours * salarySettings.value.overtimeRate) : 0,
        lateDeduction: 0, // API에서 제공되지 않음
        absentDeduction: 0, // API에서 제공되지 않음
        totalSalary: employee.salary,
        workingDaysInMonth: 0 // API에서 제공되지 않음
      }
    }
  })

  const getAllEmployeeSalaries = computed(() => {
    return employeePayrolls.value.map(employee => {
      const stats = getEmployeeMonthlyStats.value(employee.employeeId)
      return {
        id: employee.employeeId,
        name: employee.name,
        position: employee.position,
        hourlyRate: employee.hourlyPay,
        monthlyPay: employee.monthlyPay,
        ...stats
      }
    })
  })

  const getTotalMonthlyCost = computed(() => {
    return payrollDashboard.value.expectedExpense || 0
  })

  // Utility functions
  const getWorkingDaysInMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    let workingDays = 0
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayOfWeek = date.getDay()
      // 주말 제외 (0: 일요일, 6: 토요일)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++
      }
    }
    
    return workingDays
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

  return {
    // State
    loading,
    error,
    payrollDashboard,
    employeePayrolls,
    employeeDetail,
    salarySettings,
    
    // Actions
    fetchPayrollDashboard,
    fetchEmployeePayrolls,
    fetchEmployeePayrollDetail,
    
    // Getters
    getEmployeeMonthlyStats,
    getAllEmployeeSalaries,
    getTotalMonthlyCost,
    
    // Utilities
    getWorkingDaysInMonth,
    formatWorkDuration,
    formatSalary
  }
})