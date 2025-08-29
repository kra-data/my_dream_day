<template>
  <div class="tab-content">
    <div class="employees-section">
      <div class="section-header">
        <h2>👥 직원 관리</h2>
        <button @click="showAddEmployeeModal = true" class="btn btn-primary">
          + 직원 추가
        </button>
      </div>

      <div class="employees-table">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>구역</th>
              <th>직위</th>
              <th>급여</th>
              <th>오늘 출근</th>
              <th>오늘 퇴근</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="employeesStore.employees.length === 0">
              <td colspan="9" class="no-data">등록된 직원이 없습니다</td>
            </tr>
            <tr v-else v-for="employee in employeesStore.employees" :key="employee.id">
              <td>
                <div class="employee-cell">
                  <div class="employee-avatar">
                    {{ employee.name.charAt(0) }}
                  </div>
                  {{ employee.name }}
                </div>
              </td>
              <td>{{ formatSection(employee.section) }}</td>
              <td>{{ formatPosition(employee.position) }}</td>
              <td>{{ formatPay(employee.pay, employee.payUnit) }}</td>
              <td>{{ getCheckInTime(employee.id) || '-' }}</td>
              <td>{{ getCheckOutTime(employee.id) || '-' }}</td>
              <td>
                <StatusBadge :status="getEmployeeStatus(employee.id)" />
              </td>
              <td>
                <div class="action-buttons">
                  <button 
                    @click="editEmployee(employee)"
                    class="btn btn-secondary btn-sm"
                  >
                    수정
                  </button>
                  <button 
                    @click="deleteEmployee(employee.id)"
                    class="btn btn-danger btn-sm"
                    :disabled="employeesStore.loading"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- QR 코드 모달 -->
    <div v-if="showQRModal" class="modal-overlay" @click="closeQRModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ qrEmployee.name }}님의 QR 코드</h3>
          <button @click="closeQRModal" class="modal-close">&times;</button>
        </div>
        <div class="qr-display">
          <div class="qr-code">
            <!-- QR 코드는 실제로는 라이브러리로 생성 -->
            <div class="qr-placeholder">
              <div class="qr-pattern"></div>
              <div class="qr-data">{{ qrEmployee.qrCode }}</div>
            </div>
          </div>
          <p>직원이 이 QR 코드를 스캔하여 출퇴근할 수 있습니다</p>
          <button @click="printQR" class="btn btn-primary">🖨️ 인쇄</button>
        </div>
      </div>
    </div>

    <!-- 직원 추가/수정 모달 -->
    <div v-if="showAddEmployeeModal || showEditEmployeeModal" class="modal-overlay" @click="closeEmployeeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ showEditEmployeeModal ? '직원 정보 수정' : '새 직원 추가' }}</h3>
          <button @click="closeEmployeeModal" class="modal-close">&times;</button>
        </div>
        <div class="employee-form">
          <!-- 기본 정보 섹션 -->
          <div class="form-section">
            <h4 class="section-title">👤 기본 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>이름 *</label>
                <input 
                  type="text" 
                  v-model="employeeForm.name"
                  placeholder="홍길동"
                  required
                  class="form-input"
                >
              </div>
              
              <div class="form-group">
                <label>휴대폰 번호 *</label>
                <input 
                  type="tel" 
                  v-model="employeeForm.phone"
                  placeholder="010-1234-5678"
                  required
                  class="form-input"
                  @input="formatPhoneNumber"
                >
              </div>
            </div>

            <div class="form-group">
              <label>주민(외국인)등록번호 *</label>
              <input 
                type="text" 
                v-model="employeeForm.nationalId"
                placeholder="000000-0000000"
                required
                class="form-input"
                @input="formatNationalId"
              >
            </div>
          </div>

          <!-- 급여 정보 섹션 -->
          <div class="form-section">
            <h4 class="section-title">💰 급여 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>급여 단위 *</label>
                <div class="radio-group horizontal">
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.payUnit" 
                      value="HOURLY" 
                      required
                      @change="updatePayPlaceholder"
                    >
                    <span class="radio-text">💵 시급</span>
                  </label>
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.payUnit" 
                      value="MONTHLY" 
                      required
                      @change="updatePayPlaceholder"
                    >
                    <span class="radio-text">💼 월급</span>
                  </label>
                </div>
              </div>
              
              <div class="form-group">
                <label>급여 금액 *</label>
                <div class="input-with-suffix">
                  <input 
                    type="number" 
                    v-model="employeeForm.pay"
                    :placeholder="payPlaceholder"
                    required
                    min="0"
                    class="form-input"
                    @input="formatPayAmount"
                  >
                  <span class="input-suffix">원</span>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>은행명 *</label>
                <select v-model="employeeForm.bank" required class="form-select">
                  <option value="">은행을 선택하세요</option>
                  <option value="국민">🏦 국민은행</option>
                  <option value="토스">🎯 토스뱅크</option>
                  <option value="신한">🔵 신한은행</option>
                  <option value="우리">🟢 우리은행</option>
                  <option value="하나">🟡 하나은행</option>
                  <option value="농협">🌾 농협은행</option>
                  <option value="기업">🏢 기업은행</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>계좌번호 *</label>
                <input 
                  type="text" 
                  v-model="employeeForm.accountNumber"
                  placeholder="123-456-789012"
                  required
                  class="form-input"
                  @input="formatAccountNumber"
                >
              </div>
            </div>
          </div>

          <!-- 근무 정보 섹션 -->
          <div class="form-section">
            <h4 class="section-title">🏢 근무 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>직위 *</label>
                <select v-model="employeeForm.position" required class="form-select">
                  <option value="">직위를 선택하세요</option>
                  <option value="OWNER">👑 오너</option>
                  <option value="MANAGER">👨‍💼 매니저</option>
                  <option value="STAFF">👩‍💻 스태프</option>
                  <option value="PART_TIME">⏰ 아르바이트</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>근무 구역 *</label>
                <div class="radio-group horizontal">
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.section" 
                      value="HALL" 
                      required
                    >
                    <span class="radio-text">🍽️ 홀</span>
                  </label>
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.section" 
                      value="KITCHEN" 
                      required
                    >
                    <span class="radio-text">👨‍🍳 주방</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 근무 시간표 섹션 -->
          <div class="form-section">
            <h4 class="section-title">⏰ 근무 시간표</h4>
            <p class="section-description">근무하지 않는 날은 비워두세요</p>
            
            <div class="schedule-container">
              <div class="schedule-quick-actions">
                <button type="button" @click="applyWeekdaySchedule" class="btn-quick">
                  📅 평일 일괄 적용 (09:00-18:00)
                </button>
                <button type="button" @click="clearSchedule" class="btn-quick">
                  🗑️ 전체 초기화
                </button>
              </div>

              <div class="schedule-grid">
                <div v-for="day in days" :key="day" class="schedule-day">
                  <div class="day-header">
                    <span class="day-name">{{ dayLabels[day] }}</span>
                    <label class="checkbox-wrapper">
                      <input 
                        type="checkbox" 
                        :checked="isWorkingDay(day)"
                        @change="toggleWorkingDay(day)"
                        class="day-checkbox"
                      >
                      <span class="checkmark">근무일</span>
                    </label>
                  </div>
                  
                  <div class="schedule-times" v-if="isWorkingDay(day)">
                    <div class="time-input-group">
                      <label>시작</label>
                      <input 
                        type="time" 
                        v-model="employeeForm.schedule[day].start"
                        class="time-input"
                      >
                    </div>
                    <div class="time-separator">~</div>
                    <div class="time-input-group">
                      <label>종료</label>
                      <input 
                        type="time" 
                        v-model="employeeForm.schedule[day].end"
                        class="time-input"
                      >
                    </div>
                  </div>
                  
                  <div class="no-work-day" v-else>
                    휴무
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button @click="closeEmployeeModal" class="btn btn-secondary" :disabled="employeesStore.loading">
              취소
            </button>
            <button @click="saveEmployee" class="btn btn-primary" :disabled="employeesStore.loading">
              <span v-if="employeesStore.loading">💾 저장 중...</span>
              <span v-else>{{ showEditEmployeeModal ? '✏️ 수정 완료' : '➕ 직원 추가' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminEmployeeView',
  components: {
    StatusBadge
  },
  emits: ['retry-fetch'],
  setup(props, { emit }) {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    
    // 모달 상태
    const showQRModal = ref(false)
    const showAddEmployeeModal = ref(false)
    const showEditEmployeeModal = ref(false)
    const qrEmployee = ref(null)
    const editingEmployeeId = ref(null)
    
    // 폼 데이터
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const dayLabels = {
      mon: '월요일',
      tue: '화요일',
      wed: '수요일',
      thu: '목요일',
      fri: '금요일',
      sat: '토요일',
      sun: '일요일'
    }
    
    const payPlaceholder = ref('급여 단위를 먼저 선택하세요')
    
    const employeeForm = ref({
      name: '',
      nationalId: '',
      accountNumber: '',
      bank: '',
      phone: '',
      position: '',
      section: '',
      pay: 0,
      payUnit: '',
      schedule: {
        mon: { start: '', end: '' },
        tue: { start: '', end: '' },
        wed: { start: '', end: '' },
        thu: { start: '', end: '' },
        fri: { start: '', end: '' },
        sat: { start: '', end: '' },
        sun: { start: '', end: '' }
      }
    })
    
    return {
      employeesStore,
      attendanceStore,
      showQRModal,
      showAddEmployeeModal,
      showEditEmployeeModal,
      qrEmployee,
      editingEmployeeId,
      days,
      dayLabels,
      employeeForm,
      payPlaceholder,
      emit
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
        'OWNER': '점장',
        'MANAGER': '매니저',
        'STAFF': '직원',
        'PART_TIME': '알바'
      }
      return positions[position] || position
    },
    
    formatPay(pay, payUnit) {
      return `${pay.toLocaleString()}원 (${payUnit === 'HOURLY' ? '시급' : '월급'})`
    },
    
    getEmployeeStatus(employeeId) {
      const activeEmployee = this.attendanceStore.activeEmployees.find(emp => emp.employeeId === employeeId)
      
      if (!activeEmployee || !activeEmployee.clockInAt) return 'not-checked-in'
      return 'working'
    },
    
    getCheckInTime(employeeId) {
      const activeEmployee = this.attendanceStore.activeEmployees.find(emp => emp.employeeId === employeeId)
      return activeEmployee?.clockInAt ? this.formatTime(activeEmployee.clockInAt) : null
    },
    
    getCheckOutTime(employeeId) {
      const recentActivity = this.attendanceStore.recentActivities.find(act => 
        act.employeeId === employeeId && act.type === 'OUT' && 
        new Date(act.clockOutAt || act.clockInAt).toDateString() === new Date().toDateString()
      )
      return recentActivity?.clockOutAt ? this.formatTime(recentActivity.clockOutAt) : null
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    showQRCode(employee) {
      this.qrEmployee = employee
      this.showQRModal = true
    },
    
    closeQRModal() {
      this.showQRModal = false
      this.qrEmployee = null
    },
    
    printQR() {
      window.print()
    },
    
    editEmployee(employee) {
      this.editingEmployeeId = employee.id
      this.employeeForm = {
        ...employee,
        schedule: {
          mon: employee.schedule?.mon || { start: '', end: '' },
          tue: employee.schedule?.tue || { start: '', end: '' },
          wed: employee.schedule?.wed || { start: '', end: '' },
          thu: employee.schedule?.thu || { start: '', end: '' },
          fri: employee.schedule?.fri || { start: '', end: '' },
          sat: employee.schedule?.sat || { start: '', end: '' },
          sun: employee.schedule?.sun || { start: '', end: '' }
        }
      }
      this.showEditEmployeeModal = true
    },
    
    async deleteEmployee(employeeId) {
      if (confirm('정말로 이 직원을 삭제하시겠습니까?')) {
        try {
          await this.employeesStore.deleteEmployee(employeeId)
          this.attendanceStore.deleteRecordsByEmployee(employeeId)
          alert('직원이 삭제되었습니다')
          this.emit('retry-fetch')
        } catch (error) {
          alert('직원 삭제에 실패했습니다: ' + error.message)
        }
      }
    },
    
    closeEmployeeModal() {
      this.showAddEmployeeModal = false
      this.showEditEmployeeModal = false
      this.editingEmployeeId = null
      this.employeeForm = {
        name: '',
        nationalId: '',
        accountNumber: '',
        bank: '',
        phone: '',
        position: '',
        section: '',
        pay: 0,
        payUnit: '',
        schedule: {
          mon: { start: '', end: '' },
          tue: { start: '', end: '' },
          wed: { start: '', end: '' },
          thu: { start: '', end: '' },
          fri: { start: '', end: '' },
          sat: { start: '', end: '' },
          sun: { start: '', end: '' }
        }
      }
    },
    
    // 입력 포맷팅 메서드들
    formatPhoneNumber() {
      let value = this.employeeForm.phone.replace(/\D/g, '')
      if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
        this.employeeForm.phone = value
      }
    },

    formatNationalId() {
      let value = this.employeeForm.nationalId.replace(/\D/g, '')
      if (value.length <= 13) {
        value = value.replace(/(\d{6})(\d{7})/, '$1-$2')
        this.employeeForm.nationalId = value
      }
    },

    formatAccountNumber() {
      // 계좌번호는 은행별로 다르지만 일반적인 형식으로 포맷팅
      let value = this.employeeForm.accountNumber.replace(/\D/g, '')
      if (value.length <= 14) {
        value = value.replace(/(\d{3})(\d{6})(\d{5})/, '$1-$2-$3')
        this.employeeForm.accountNumber = value
      }
    },

    formatPayAmount() {
      // 급여 금액에 콤마 추가 (실제 저장은 숫자로)
      if (this.employeeForm.pay) {
        const numValue = parseInt(this.employeeForm.pay.toString().replace(/,/g, ''))
        this.employeeForm.pay = numValue
      }
    },

    updatePayPlaceholder() {
      if (this.employeeForm.payUnit === 'HOURLY') {
        this.payPlaceholder = '15,000 (시급)'
      } else if (this.employeeForm.payUnit === 'MONTHLY') {
        this.payPlaceholder = '3,000,000 (월급)'
      } else {
        this.payPlaceholder = '급여 단위를 먼저 선택하세요'
      }
    },

    // 근무 시간표 관련 메서드들
    isWorkingDay(day) {
      const schedule = this.employeeForm.schedule[day]
      return schedule.start !== '' || schedule.end !== ''
    },

    toggleWorkingDay(day) {
      if (this.isWorkingDay(day)) {
        // 근무일에서 휴무일로 변경
        this.employeeForm.schedule[day] = { start: '', end: '' }
      } else {
        // 휴무일에서 근무일로 변경 (기본 시간 설정)
        this.employeeForm.schedule[day] = { start: '09:00', end: '18:00' }
      }
    },

    applyWeekdaySchedule() {
      const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri']
      weekdays.forEach(day => {
        this.employeeForm.schedule[day] = { start: '09:00', end: '18:00' }
      })
      // 주말은 휴무로 설정
      this.employeeForm.schedule.sat = { start: '', end: '' }
      this.employeeForm.schedule.sun = { start: '', end: '' }
    },

    clearSchedule() {
      this.days.forEach(day => {
        this.employeeForm.schedule[day] = { start: '', end: '' }
      })
    },

    async saveEmployee() {
      // 필수 필드 검증
      if (!this.employeeForm.name ||
          !this.employeeForm.nationalId ||
          !this.employeeForm.accountNumber ||
          !this.employeeForm.bank ||
          !this.employeeForm.phone ||
          !this.employeeForm.position ||
          !this.employeeForm.section ||
          !this.employeeForm.pay ||
          !this.employeeForm.payUnit) {
        alert('모든 필수 항목을 입력해주세요')
        return
      }

      // 휴대폰 번호 검증
      const phoneRegex = /^\d{3}-\d{4}-\d{4}$/
      if (!phoneRegex.test(this.employeeForm.phone)) {
        alert('올바른 휴대폰 번호 형식을 입력해주세요 (010-1234-5678)')
        return
      }

      // 주민등록번호 검증
      const nationalIdRegex = /^\d{6}-\d{7}$/
      if (!nationalIdRegex.test(this.employeeForm.nationalId)) {
        alert('올바른 주민등록번호 형식을 입력해주세요 (000000-0000000)')
        return
      }
      
      try {
        const employeeData = {
          ...this.employeeForm,
          // 포맷팅된 값들을 원본 형태로 변환
          phone: this.employeeForm.phone.replace(/-/g, ''),
          nationalId: this.employeeForm.nationalId.replace(/-/g, ''),
          accountNumber: this.employeeForm.accountNumber.replace(/-/g, ''),
          schedule: Object.fromEntries(
            Object.entries(this.employeeForm.schedule).filter(([day, times]) => 
              times.start && times.end
            )
          )
        }
        
        if (this.showEditEmployeeModal) {
          await this.employeesStore.updateEmployee(this.editingEmployeeId, employeeData)
          alert('✅ 직원 정보가 성공적으로 수정되었습니다')
        } else {
          await this.employeesStore.addEmployee(employeeData)
          alert('✅ 새 직원이 성공적으로 추가되었습니다')
        }
        
        this.closeEmployeeModal()
        this.emit('retry-fetch')
      } catch (error) {
        alert('❌ 저장에 실패했습니다: ' + error.message)
      }
    }
  }
}
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  color: #1f2937;
  margin: 0;
}

.employees-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

.employee-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.employee-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.action-buttons {
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
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}

.qr-display {
  text-align: center;
}

.qr-code {
  margin: 20px 0;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  border: 2px dashed #d1d5db;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #f9fafb;
}

.qr-pattern {
  width: 150px;
  height: 150px;
  background: 
    repeating-linear-gradient(
      0deg,
      #000 0px,
      #000 10px,
      #fff 10px,
      #fff 20px
    ),
    repeating-linear-gradient(
      90deg,
      #000 0px,
      #000 10px,
      #fff 10px,
      #fff 20px
    );
  background-size: 20px 20px;
  margin-bottom: 10px;
}

.qr-data {
  font-weight: 600;
  color: #374151;
}

/* 개선된 직원 폼 스타일 */
.employee-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-description {
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.form-input, .form-select {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
  background: white;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-suffix {
  position: absolute;
  right: 16px;
  color: #6b7280;
  font-weight: 500;
  pointer-events: none;
}

/* 라디오 버튼 개선 */
.radio-group {
  display: flex;
  gap: 8px;
}

.radio-group.horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.radio-option {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  flex: 1;
  justify-content: center;
}

.radio-option:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.radio-option input[type="radio"] {
  display: none;
}

.radio-option input[type="radio"]:checked + .radio-text {
  color: #3b82f6;
  font-weight: 600;
}

.radio-option:has(input[type="radio"]:checked) {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.radio-text {
  font-size: 0.9rem;
  color: #374151;
  transition: all 0.2s;
}

/* 근무 시간표 스타일 */
.schedule-container {
  margin-top: 16px;
}

.schedule-quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.btn-quick {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-quick:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.schedule-grid {
  display: grid;
  gap: 16px;
}

.schedule-day {
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  background: white;
  transition: all 0.2s;
}

.schedule-day:hover {
  border-color: #cbd5e1;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.day-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.95rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.day-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.checkmark {
  font-size: 0.8rem;
  color: #64748b;
}

.schedule-times {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.time-input-group label {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
}

.time-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 90px;
  text-align: center;
}

.time-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.time-separator {
  font-weight: 600;
  color: #9ca3af;
  font-size: 1.2rem;
  margin: 0 8px;
}

.no-work-day {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  padding: 20px 0;
  background: #f8fafc;
  border-radius: 6px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .employees-table {
    overflow-x: auto;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .modal-content {
    max-width: 95%;
    margin: 10px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .radio-group.horizontal {
    flex-direction: column;
    gap: 8px;
  }
  
  .schedule-quick-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .btn-quick {
    font-size: 0.8rem;
    padding: 6px 12px;
  }
  
  .schedule-times {
    flex-direction: column;
    gap: 8px;
  }
  
  .time-separator {
    transform: rotate(90deg);
    margin: 4px 0;
  }
}
</style>