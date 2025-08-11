<template>
  <div class="tab-content">
    <div class="records-section">
      <div class="section-header">
        <h2>📋 출퇴근 기록</h2>
        <div class="filters">
          <input 
            type="date" 
            v-model="selectedDate"
            class="date-input"
          >
          <select v-model="selectedEmployee" class="employee-filter">
            <option value="">전체 직원</option>
            <option 
              v-for="employee in employeesStore.employees" 
              :key="employee.id"
              :value="employee.id"
            >
              {{ employee.name }}
            </option>
          </select>
          <button @click="exportRecords" class="btn btn-success">
            📄 엑셀 내보내기
          </button>
        </div>
      </div>

      <div class="records-table">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>직원명</th>
              <th>구역</th>
              <th>출근시간</th>
              <th>퇴근시간</th>
              <th>근무시간</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredRecords.length === 0">
              <td colspan="7" class="no-data">출퇴근 기록이 없습니다</td>
            </tr>
            <tr v-else v-for="record in filteredRecords" :key="record.id">
              <td>{{ formatDate(record.clockInAt || record.date) }}</td>
              <td>{{ getEmployeeName(record.employeeId) }}</td>
              <td>{{ formatSection(getEmployeeSection(record.employeeId)) }}</td>
              <td>{{ record.clockInAt ? formatTime(record.clockInAt) : '-' }}</td>
              <td>{{ record.clockOutAt ? formatTime(record.clockOutAt) : '-' }}</td>
              <td>{{ formatWorkDuration(record.workedMinutes) }}</td>
              <td>
                <StatusBadge :status="getRecordStatus(record)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminRecordsView',
  components: {
    StatusBadge
  },
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    
    // 필터 상태
    const selectedDate = ref(new Date().toISOString().split('T')[0])
    const selectedEmployee = ref('')
    
    // 필터링된 기록
    const filteredRecords = computed(() => {
      let records = attendanceStore.records
      
      if (selectedDate.value) {
        const targetDate = new Date(selectedDate.value).toDateString()
        records = records.filter(record => 
          new Date(record.clockInAt || record.date).toDateString() === targetDate
        )
      }
      
      if (selectedEmployee.value) {
        records = records.filter(record => 
          record.employeeId === parseInt(selectedEmployee.value)
        )
      }
      
      return records.sort((a, b) => new Date(b.clockInAt || b.date) - new Date(a.clockInAt || a.date))
    })
    
    return {
      employeesStore,
      attendanceStore,
      selectedDate,
      selectedEmployee,
      filteredRecords
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
    
    getEmployeeName(employeeId) {
      const employee = this.employeesStore.getEmployeeById(employeeId)
      return employee ? employee.name : '알 수 없음'
    },
    
    getEmployeeSection(employeeId) {
      const employee = this.employeesStore.getEmployeeById(employeeId)
      return employee ? employee.section : '알 수 없음'
    },
    
    getRecordStatus(record) {
      if (!record.clockInAt) return 'not-checked-in'
      if (record.clockOutAt) return 'completed'
      return 'working'
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString('ko-KR')
    },
    
    formatWorkDuration(workedMinutes) {
      if (workedMinutes === null || workedMinutes === undefined) return '-'
      
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      
      return `${hours}시간 ${minutes}분`
    },
    
    exportRecords() {
      const headers = ['날짜', '직원명', '구역', '출근시간', '퇴근시간', '근무시간']
      const csvData = [headers]
      
      this.filteredRecords.forEach(record => {
        csvData.push([
          this.formatDate(record.clockInAt || record.date),
          this.getEmployeeName(record.employeeId),
          this.formatSection(this.getEmployeeSection(record.employeeId)),
          record.clockInAt ? this.formatTime(record.clockInAt) : '-',
          record.clockOutAt ? this.formatTime(record.clockOutAt) : '-',
          this.formatWorkDuration(record.workedMinutes)
        ])
      })
      
      const csvContent = csvData.map(row => row.join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `출퇴근기록_${this.selectedDate || '전체'}.csv`
      link.click()
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

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.date-input, .employee-filter {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.records-table {
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

.btn-success {
  background: #10b981;
  color: white;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .records-table {
    overflow-x: auto;
  }
}
</style>