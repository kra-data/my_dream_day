import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEmployeesStore = defineStore('employees', () => {
  // State
  const employees = ref([])
  const loading = ref(false)
  const error = ref(null)

  // API 베이스 URL (환경변수에서 가져오거나 하드코딩)
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

  // JWT 토큰 가져오기
  const getAuthToken = () => {
    return localStorage.getItem('authToken')
  }

  // 현재 사용자의 shopId 가져오기 (JWT에서 추출)
  const getShopId = () => {
    const token = getAuthToken()
    if (!token) return null
    
    try {
      // JWT 디코딩 (간단한 방법, 실제로는 jwt-decode 라이브러리 사용 권장)
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.shopId
    } catch (error) {
      console.error('JWT 디코딩 실패:', error)
      return null
    }
  }

  // HTTP 헤더 설정
  const getHeaders = () => {
    const token = getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }

  // Actions
  const fetchEmployees = async () => {
    loading.value = true
    error.value = null
    
    try {
      const shopId = getShopId()
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다. 다시 로그인해주세요.')
      }

      const response = await fetch(`${API_BASE_URL}/admin/shops/${shopId}/employees`, {
        method: 'GET',
        headers: getHeaders()
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      employees.value = data || []
      
      console.log('직원 목록 조회 완료:', employees.value)
    } catch (error) {
      console.error('직원 목록 조회 실패:', error)
      error.value = error.message || '직원 목록을 불러오는데 실패했습니다'
      
      // 네트워크 에러나 401 에러일 경우 임시 데이터 사용 (개발용)
      if (import.meta.env.DEV) {
        console.warn('개발 모드: 임시 직원 데이터를 사용합니다')
        employees.value = [
          {
            id: 1,
            name: '홍길동',
            nationalId: '900101-1******',
            accountNumber: '123-456-789',
            bank: '국민',
            phone: '01012341234',
            position: 'MANAGER',
            section: 'HALL',
            pay: 3000000,
            payUnit: 'MONTHLY',
            qrCode: '1',
            schedule: {
              mon: { start: '09:00', end: '18:00' },
              tue: { start: '09:00', end: '18:00' },
              wed: { start: '09:00', end: '18:00' },
              thu: { start: '09:00', end: '18:00' },
              fri: { start: '09:00', end: '18:00' },
              sat: { start: '', end: '' },
              sun: { start: '', end: '' }
            }
          },
          {
            id: 2,
            name: '김철수',
            nationalId: '950315-1******',
            accountNumber: '987-654-321',
            bank: '신한',
            phone: '01056785432',
            position: 'STAFF',
            section: 'KITCHEN',
            pay: 15000,
            payUnit: 'HOURLY',
            qrCode: '2',
            schedule: {
              mon: { start: '10:00', end: '19:00' },
              tue: { start: '10:00', end: '19:00' },
              wed: { start: '10:00', end: '19:00' },
              thu: { start: '10:00', end: '19:00' },
              fri: { start: '10:00', end: '19:00' },
              sat: { start: '10:00', end: '16:00' },
              sun: { start: '', end: '' }
            }
          }
        ]
      }
    } finally {
      loading.value = false
    }
  }

  const addEmployee = async (employeeData) => {
    loading.value = true
    error.value = null
    
    try {
      const shopId = getShopId()
      if (!shopId) {
        throw new Error('매장 정보를 찾을 수 없습니다')
      }

      // payUnit 자동 설정
      const processedData = {
        ...employeeData,
        payUnit: employeeData.payUnit || 
          (employeeData.position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY')
      }

      const response = await fetch(`${API_BASE_URL}/admin/shops/${shopId}/employees`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(processedData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const newEmployee = await response.json()
      
      // 새로 추가된 직원을 목록에 추가
      if (newEmployee) {
        employees.value.push(newEmployee)
      } else {
        // 서버에서 직원 데이터를 바로 반환하지 않는 경우 다시 목록 조회
        await fetchEmployees()
      }
      
      console.log('직원 추가 완료:', newEmployee)
      return newEmployee
    } catch (error) {
      console.error('직원 추가 실패:', error)
      error.value = error.message || '직원 추가에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateEmployee = async (empId, employeeData) => {
    loading.value = true
    error.value = null
    
    try {
      // payUnit 자동 설정
      const processedData = {
        ...employeeData,
        payUnit: employeeData.payUnit || 
          (employeeData.position === 'PART_TIME' ? 'HOURLY' : 'MONTHLY')
      }

      const response = await fetch(`${API_BASE_URL}/admin/employees/${empId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(processedData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const updatedEmployee = await response.json()
      
      // 로컬 상태 업데이트
      const index = employees.value.findIndex(emp => emp.id === empId)
      if (index !== -1) {
        employees.value[index] = updatedEmployee || { ...employees.value[index], ...processedData }
      }
      
      console.log('직원 수정 완료:', updatedEmployee)
      return updatedEmployee
    } catch (error) {
      console.error('직원 수정 실패:', error)
      error.value = error.message || '직원 정보 수정에 실패했습니다'
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteEmployee = async (empId) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees/${empId}`, {
        method: 'DELETE',
        headers: getHeaders()
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }
      
      // 로컬 상태에서 제거
      const index = employees.value.findIndex(emp => emp.id === empId)
      if (index !== -1) {
        employees.value.splice(index, 1)
      }
      
      console.log('직원 삭제 완료:', empId)
    } catch (error) {
      console.error('직원 삭제 실패:', error)
      error.value = error.message || '직원 삭제에 실패했습니다'
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
    const token = getAuthToken()
    if (!token) return false
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp > Date.now() / 1000
    } catch {
      return false
    }
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