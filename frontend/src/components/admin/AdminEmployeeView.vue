<template>
  <div class="tab-content">
    <div class="employees-section">
      <div class="section-header">
        <h2><AppIcon name="users" :size="20" class="mr-2" />직원 관리</h2>
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
                  <div 
                    class="employee-avatar" 
                    :style="{ backgroundColor: employee.personalColor || getDefaultColor(employee.position) }"
                  >
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
                    @click="clockInEmployee(employee.id)"
                    class="btn btn-success btn-sm"
                    :disabled="attendanceStore.loading || getEmployeeStatus(employee.id) === 'working'"
                    title="출근 처리"
                  >
                    출근
                  </button>
                  <button 
                    @click="clockOutEmployee(employee.id)"
                    class="btn btn-warning btn-sm"
                    :disabled="attendanceStore.loading || getEmployeeStatus(employee.id) !== 'working'"
                    title="퇴근 처리"
                  >
                    퇴근
                  </button>
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
          <button @click="printQR" class="btn btn-primary"><AppIcon name="printer" :size="16" class="mr-1" />인쇄</button>
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
            <h4 class="section-title"><AppIcon name="user" :size="18" class="mr-2" />기본 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>이름 *</label>
                <input 
                  type="text" 
                  v-model="employeeForm.name"
                  placeholder="홍길동"
                  required
                  class="form-input"
                  :readonly="showEditEmployeeModal"
                  :class="{ 'readonly-field': showEditEmployeeModal }"
                >
                <small v-if="showEditEmployeeModal" class="field-note">이름은 수정할 수 없습니다</small>
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
                :readonly="showEditEmployeeModal"
                :class="{ 'readonly-field': showEditEmployeeModal }"
                @input="formatNationalId"
              >
              <small v-if="showEditEmployeeModal" class="field-note">보안상 주민등록번호는 수정할 수 없습니다</small>
            </div>

            <div class="form-group">
              <label>개인 컬러</label>
              <div class="color-palette">
                <div 
                  v-for="color in colorOptions" 
                  :key="color.value"
                  class="color-option"
                  :class="{ active: employeeForm.personalColor === color.value }"
                  :style="{ backgroundColor: color.value }"
                  @click="employeeForm.personalColor = color.value"
                  :title="color.name"
                >
                  <AppIcon v-if="employeeForm.personalColor === color.value" name="check" :size="14" />
                </div>
              </div>
              <div class="color-preview" v-if="employeeForm.personalColor">
                <div class="preview-avatar" :style="{ backgroundColor: employeeForm.personalColor }">
                  {{ employeeForm.name.charAt(0) || 'A' }}
                </div>
                <span class="preview-text">미리보기</span>
              </div>
            </div>
          </div>

          <!-- 급여 정보 섹션 -->
          <div class="form-section">
            <h4 class="section-title"><AppIcon name="money" :size="18" class="mr-2" />급여 정보</h4>
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
                    <span class="radio-text"><AppIcon name="money" :size="16" class="mr-1" />시급</span>
                  </label>
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.payUnit" 
                      value="MONTHLY" 
                      required
                      @change="updatePayPlaceholder"
                    >
                    <span class="radio-text"><AppIcon name="briefcase" :size="16" class="mr-1" />월급</span>
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
                  <option value="국민">국민은행</option>
                  <option value="신한">신한은행</option>
                  <option value="우리">우리은행</option>
                  <option value="하나">하나은행</option>
                  <option value="농협">농협은행</option>
                  <option value="기업">기업은행</option>
                  <option value="SC">SC은행</option>
                  <option value="새마을금고">새마을금고</option>
                  <option value="수협">수협</option>
                  <option value="신협">신협</option>
                  <option value="케이">케이뱅크</option>
                  <option value="토스">토스뱅크</option>
                  <option value="카카오">카카오뱅크</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>계좌번호 *</label>
                <input 
                  type="text" 
                  v-model="employeeForm.accountNumber"
                  placeholder="123456789012"
                  required
                  class="form-input"
                  @input="formatAccountNumber"
                >
                <span class="field-help-text">숫자만 입력해주세요</span>
              </div>
            </div>
          </div>

          <!-- 근무 정보 섹션 -->
          <div class="form-section">
            <h4 class="section-title"><AppIcon name="hall" :size="18" class="mr-2" />근무 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>직위 *</label>
                <select v-model="employeeForm.position" required class="form-select">
                  <option value="">직위를 선택하세요</option>
                  <option value="OWNER"><AppIcon name="crown" :size="16" class="mr-1" />오너</option>
                  <option value="MANAGER"><AppIcon name="user-tie" :size="16" class="mr-1" />매니저</option>
                  <option value="STAFF"><AppIcon name="user-laptop" :size="16" class="mr-1" />스태프</option>
                  <option value="PART_TIME"><AppIcon name="clock" :size="16" class="mr-1" />아르바이트</option>
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
                    <span class="radio-text"><AppIcon name="utensils" :size="16" class="mr-1" />홀</span>
                  </label>
                  <label class="radio-option">
                    <input 
                      type="radio" 
                      v-model="employeeForm.section" 
                      value="KITCHEN" 
                      required
                    >
                    <span class="radio-text"><AppIcon name="chef-hat" :size="16" class="mr-1" />주방</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 근무 시간표 섹션 -->
          <div class="form-section">
            <h4 class="section-title"><AppIcon name="clock" :size="18" class="mr-2" />근무 시간표</h4>
            <p class="section-description">근무하지 않는 날은 비워두세요</p>
            
            <div class="schedule-container">
              <div class="schedule-quick-actions">
                <button type="button" @click="applyWeekdaySchedule" class="btn-quick">
                  <AppIcon name="calendar" :size="16" class="mr-1" />평일 일괄 적용 (09:00-18:00)
                </button>
                <button type="button" @click="clearSchedule" class="btn-quick">
                  <AppIcon name="trash" :size="16" class="mr-1" />전체 초기화
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
              <span v-if="employeesStore.loading"><AppIcon name="save" :size="16" class="mr-1" />저장 중...</span>
              <span v-else><AppIcon :name="showEditEmployeeModal ? 'edit' : 'plus'" :size="16" class="mr-1" />{{ showEditEmployeeModal ? '수정 완료' : '직원 추가' }}</span>
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
import AppIcon from '@/components/AppIcon.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminEmployeeView',
  components: {
    StatusBadge,
    AppIcon
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
    
    // 색상 옵션
    const colorOptions = [
      { name: '블루', value: '#3b82f6' },
      { name: '그린', value: '#10b981' },
      { name: '퍼플', value: '#8b5cf6' },
      { name: '핑크', value: '#ec4899' },
      { name: '옐로우', value: '#f59e0b' },
      { name: '레드', value: '#ef4444' },
      { name: '인디고', value: '#6366f1' },
      { name: '시안', value: '#06b6d4' },
      { name: '에메랄드', value: '#059669' },
      { name: '로즈', value: '#f43f5e' },
      { name: '바이올렛', value: '#7c3aed' },
      { name: '앰버', value: '#d97706' }
    ]
    
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
      personalColor: '#3b82f6', // 기본값으로 블루 설정
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
      colorOptions,
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
        minute: '2-digit',
        hour12: false
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
        // 수정 시 포맷된 형태로 표시
        phone: employee.phone ? employee.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '',
        nationalId: employee.nationalId ? employee.nationalId.replace(/(\d{6})(\d{7})/, '$1-$2') : '',
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
        personalColor: '#3b82f6',
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
      // 계좌번호는 숫자만 허용 (하이픈 제거)
      let value = this.employeeForm.accountNumber.replace(/\D/g, '')
      this.employeeForm.accountNumber = value
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
            Object.entries(this.employeeForm.schedule).filter(([, times]) => 
              times.start && times.end
            )
          )
        }
        
        if (this.showEditEmployeeModal) {
          await this.employeesStore.updateEmployee(this.editingEmployeeId, employeeData)
          alert('직원 정보가 성공적으로 수정되었습니다')
        } else {
          await this.employeesStore.addEmployee(employeeData)
          alert('새 직원이 성공적으로 추가되었습니다')
        }
        
        this.closeEmployeeModal()
        this.emit('retry-fetch')
      } catch (error) {
        alert('저장에 실패했습니다: ' + error.message)
      }
    },

    // 관리자용 수동 출근 처리
    async clockInEmployee(employeeId) {
      try {
        await this.attendanceStore.manualAttendance(employeeId, 'IN')
        alert('출근 처리가 완료되었습니다')
        this.emit('retry-fetch')
      } catch (error) {
        alert('출근 처리에 실패했습니다: ' + error.message)
      }
    },

    // 관리자용 수동 퇴근 처리  
    async clockOutEmployee(employeeId) {
      try {
        await this.attendanceStore.manualAttendance(employeeId, 'OUT')
        alert('퇴근 처리가 완료되었습니다')
        this.emit('retry-fetch')
      } catch (error) {
        alert('퇴근 처리에 실패했습니다: ' + error.message)
      }
    },

    getEmployeeAvatarClass(position) {
      const positionClasses = {
        'OWNER': 'avatar-owner',
        'MANAGER': 'avatar-manager', 
        'STAFF': 'avatar-staff',
        'PART_TIME': 'avatar-part-time'
      }
      return positionClasses[position] || 'avatar-staff'
    },

    getDefaultColor(position) {
      const positionColors = {
        'OWNER': '#8b5cf6',
        'MANAGER': '#06b6d4',
        'STAFF': '#10b981',
        'PART_TIME': '#f59e0b'
      }
      return positionColors[position] || '#3b82f6'
    }
  }
}
</script>

<style scoped src="@/assets/styles/admin/AdminEmployeeView.css"></style>
