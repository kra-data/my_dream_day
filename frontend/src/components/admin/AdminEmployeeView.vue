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
          <div class="form-group">
            <label>이름 *</label>
            <input 
              type="text" 
              v-model="employeeForm.name"
              placeholder="직원 이름을 입력하세요"
              required
            >
          </div>
          
          <div class="form-group">
            <label>주민(외국인)등록번호 *</label>
            <input 
              type="text" 
              v-model="employeeForm.nationalId"
              placeholder="주민등록번호 입력"
              required
            >
          </div>
          
          <div class="form-group">
            <label>급여 계좌번호 *</label>
            <input 
              type="text" 
              v-model="employeeForm.accountNumber"
              placeholder="계좌번호 입력"
              required
            >
          </div>
          
          <div class="form-group">
            <label>은행명 *</label>
            <select v-model="employeeForm.bank" required>
              <option value="">은행 선택</option>
              <option value="국민">국민</option>
              <option value="토스">토스</option>
              <option value="신한">신한</option>
              <option value="우리">우리</option>
              <option value="하나">하나</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>휴대폰 번호 *</label>
            <input 
              type="tel" 
              v-model="employeeForm.phone"
              placeholder="01012341234"
              required
            >
          </div>
          
          <div class="form-group">
            <label>직위 *</label>
            <select v-model="employeeForm.position" required>
              <option value="">직위 선택</option>
              <option value="OWNER">오너</option>
              <option value="MANAGER">매니저</option>
              <option value="STAFF">스태프</option>
              <option value="PART_TIME">아르바이트</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>구역 *</label>
            <div class="radio-group">
              <label class="radio-label">
                <input 
                  type="radio" 
                  v-model="employeeForm.section" 
                  value="HALL" 
                  required
                >
                홀
              </label>
              <label class="radio-label">
                <input 
                  type="radio" 
                  v-model="employeeForm.section" 
                  value="KITCHEN" 
                  required
                >
                주방
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>급여 *</label>
            <input 
              type="number" 
              v-model="employeeForm.pay"
              placeholder="급여 금액 입력"
              required
              min="0"
            >
          </div>
          
          <div class="form-group">
            <label>급여 단위 *</label>
            <select v-model="employeeForm.payUnit" required>
              <option value="">급여 단위 선택</option>
              <option value="HOURLY">시급</option>
              <option value="MONTHLY">월급</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>근무 시간표</label>
            <div class="schedule-grid">
              <div v-for="day in days" :key="day" class="schedule-day">
                <label>{{ dayLabels[day] }}</label>
                <div class="schedule-times">
                  <input 
                    type="time" 
                    v-model="employeeForm.schedule[day].start"
                    placeholder="시작 시간"
                  >
                  <span>-</span>
                  <input 
                    type="time" 
                    v-model="employeeForm.schedule[day].end"
                    placeholder="종료 시간"
                  >
                </div>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button @click="closeEmployeeModal" class="btn btn-secondary" :disabled="employeesStore.loading">
              취소
            </button>
            <button @click="saveEmployee" class="btn btn-primary" :disabled="employeesStore.loading">
              <span v-if="employeesStore.loading">저장 중...</span>
              <span v-else>{{ showEditEmployeeModal ? '수정' : '추가' }}</span>
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
    
    async saveEmployee() {
      // 필수 필드 검증
      if (!this.employeeForm.name ||
          !this.employeeForm.nationalId ||
          !this.employeeForm.accountNumber ||
          !this.employeeForm.bank ||
          !this.employeeForm.phone ||
          !this.employeeForm.position ||
          !this.employeeForm.section ||
          !this.employeeForm.pay) {
        alert('모든 필수 항목을 입력해주세요')
        return
      }
      
      try {
        const employeeData = {
          ...this.employeeForm,
          schedule: Object.fromEntries(
            Object.entries(this.employeeForm.schedule).filter(([day, times]) => 
              times.start && times.end
            )
          )
        }
        
        if (this.showEditEmployeeModal) {
          await this.employeesStore.updateEmployee(this.editingEmployeeId, employeeData)
          alert('직원 정보가 수정되었습니다')
        } else {
          await this.employeesStore.addEmployee(employeeData)
          alert('새 직원이 추가되었습니다')
        }
        
        this.closeEmployeeModal()
        this.emit('retry-fetch')
      } catch (error) {
        alert('저장에 실패했습니다: ' + error.message)
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
  background: rgba(0,0,0,0.5);
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

.employee-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 4px;
  font-weight: 600;
  color: #374151;
}

.form-group input,
.form-group select {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.radio-group {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal !important;
  margin-bottom: 0 !important;
  cursor: pointer;
}

.radio-label input[type="radio"] {
  margin: 0;
  padding: 0;
  width: auto;
}

.schedule-grid {
  display: grid;
  gap: 12px;
}

.schedule-day {
  display: flex;
  align-items: center;
  gap: 12px;
}

.schedule-day label {
  width: 60px;
  font-weight: normal !important;
  margin-bottom: 0 !important;
}

.schedule-times {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.schedule-times input {
  width: 100px;
  padding: 8px;
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
  
  .radio-group {
    flex-direction: column;
    gap: 8px;
  }
  
  .schedule-day {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .schedule-day label {
    width: auto;
  }
}
</style>