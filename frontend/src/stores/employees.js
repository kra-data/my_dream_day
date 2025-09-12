import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref([])
  const loading = ref(false)
  const error = ref(null)

  const getApiInstance = () => {
    const authStore = useAuthStore()
    return authStore.getApiInstance()
  }

  const getShopId = () => {
    const authStore = useAuthStore()
    const user = JSON.parse(localStorage.getItem('user'))
    const shopId = user ? user.shopId : null
    return authStore.user?.shopId || shopId
  }

  const fetchEmployees = async () => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
      }

      const response = await api.get(`/admin/shops/${shopId}/employees`)
      employees.value = response.data || []
      
      console.log('직원 목록 조회 완료:', employees.value.length, '명')
    } catch (error) {
      console.error('직원 목록 조회 실패:', error)
      error.value = error.response?.data?.message || error.message || '직원 목록을 불러오는데 실패했습니다'
    } finally {
      loading.value = false
    }
  }

  const addEmployee = async (employeeData) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }

      const processedData = {
        ...employeeData,
        payUnit: employeeData.payUnit || 
          (employeeData.position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY')
      }

      const response = await api.post(`/admin/shops/${shopId}/employees`, processedData)
      const newEmployee = response.data
      
      if (newEmployee) {
        employees.value.push(newEmployee)
      } else {
        await fetchEmployees()
      }
      console.log('직원 추가 완료:', newEmployee)
      return newEmployee
    } catch (error) {
      console.error('직원 추가 실패:', error)
      error.value = error.response?.data?.message || error.message || '직원 추가에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateEmployee = async (empId, employeeData) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      
      const processedData = {
        ...employeeData,
        payUnit: employeeData.payUnit || 
          (employeeData.position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY')
      }

      const response = await api.put(`/admin/shops/${shopId}/employees/${empId}`, processedData)
      const updatedEmployee = response.data
      
      // 로컬 상태 업데이트
      const index = employees.value.findIndex(emp => emp.id === empId)
      if (index !== -1) {
        employees.value[index] = updatedEmployee || { ...employees.value[index], ...processedData }
      }
      
      console.log('직원 수정 완료:', updatedEmployee)
      return updatedEmployee
    } catch (error) {
      console.error('직원 수정 실패:', error)
      error.value = error.response?.data?.message || error.message || '직원 정보 수정에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteEmployee = async (empId) => {
    loading.value = true
    error.value = null
    
    try {
      const api = getApiInstance()
      const shopId = getShopId()
      await api.delete(`/admin/shops/${shopId}/employees/${empId}`)
      
      // 로컬 상태에서 제거
      const index = employees.value.findIndex(emp => emp.id === empId)
      if (index !== -1) {
        employees.value.splice(index, 1)
      }
      
      console.log('직원 삭제 완료:', empId)
    } catch (error) {
      console.error('직원 삭제 실패:', error)
      error.value = error.response?.data?.message || error.message || '직원 삭제에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  // Getters
  const getEmployeeById = (id) => {
    return employees.value.find(emp => emp.id === id)
  }

  const getEmployeeByQR = (qrCode) => {
    return employees.value.find(emp => emp.qrCode === qrCode)
  }

  const getEmployeesBySection = (section) => {
    return employees.value.filter(emp => emp.section === section)
  }

  const getEmployeesByPosition = (position) => {
    return employees.value.filter(emp => emp.position === position)
  }

  // 직원 이름으로 검색
  const getEmployeeByName = (name) => {
    return employees.value.find(emp => emp.name === name)
  }

  // 휴대폰 뒷4자리로 검색
  const getEmployeeByPhoneLastFour = (phoneLastFour) => {
    return employees.value.find(emp => 
      emp.phone && emp.phone.slice(-4) === phoneLastFour
    )
  }

  // 인증 상태 확인
  const isAuthenticated = () => {
    const authStore = useAuthStore()
    return authStore.isAuthenticated
  }

  return {
    // State
    employees,
    loading,
    error,
    
    // Actions
    fetchEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    
    // Getters
    getEmployeeById,
    getEmployeeByQR,
    getEmployeesBySection,
    getEmployeesByPosition,
    getEmployeeByName,
    getEmployeeByPhoneLastFour,
    isAuthenticated
  }
})