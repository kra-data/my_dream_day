<template>
  <div class="tab-content">
    <div class="analytics-section">
      <h2>📈 통계 분석</h2>
      
      <!-- 주간 통계 -->
      <div class="chart-section">
        <h3>이번 주 출근 현황</h3>
        <div class="week-chart">
          <div 
            v-for="day in weeklyStats" 
            :key="day.date"
            class="day-bar"
          >
            <div 
              class="bar"
              :style="{ height: `${employeesStore.employees.length > 0 ? (day.attendance / employeesStore.employees.length) * 100 : 0}%` }"
            ></div>
            <div class="day-label">{{ day.dayName }}</div>
            <div class="day-count">{{ day.attendance }}/{{ employeesStore.employees.length }}</div>
          </div>
        </div>
      </div>

      <!-- 부서별 통계 -->
      <div class="department-stats">
        <h3>구역별 출근율</h3>
        <div class="dept-chart">
          <div v-if="sectionStats.length === 0" class="no-data">
            구역별 데이터가 없습니다
          </div>
          <div 
            v-else
            v-for="dept in sectionStats" 
            :key="dept.name"
            class="dept-item"
          >
            <div class="dept-name">{{ formatSection(dept.name) }}</div>
            <div class="dept-progress">
              <div 
                class="dept-bar"
                :style="{ width: `${dept.rate}%` }"
              ></div>
            </div>
            <div class="dept-rate">{{ dept.rate }}%</div>
          </div>
        </div>
      </div>

      <!-- 월별 근무 시간 통계 -->
      <div class="monthly-stats">
        <h3>월별 근무 시간 통계</h3>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-title">이번 달 총 근무 시간</div>
            <div class="stat-value">{{ totalMonthlyHours }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">평균 일일 근무 시간</div>
            <div class="stat-value">{{ averageDailyHours }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">가장 활발한 요일</div>
            <div class="stat-value">{{ mostActiveDayOfWeek }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">총 출근 일수</div>
            <div class="stat-value">{{ totalWorkDays }}일</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminAnalyticsView',
  setup() {
    const employeesStore = useEmployeesStore()
    const attendanceStore = useAttendanceStore()
    
    // 주간 통계 계산
    const weeklyStats = computed(() => {
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const today = new Date()
      const weekStats = []
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        
        const dayRecords = attendanceStore.records.filter(record => 
          new Date(record.clockInAt || record.date).toDateString() === date.toDateString()
        )
        
        weekStats.push({
          date: date.toISOString().split('T')[0],
          dayName: days[date.getDay()],
          attendance: dayRecords.filter(r => r.clockInAt).length
        })
      }
      
      return weekStats
    })
    
    // 구역별 통계 계산
    const sectionStats = computed(() => {
      const sections = [...new Set(employeesStore.employees.map(emp => emp.section))]
      
      return sections.map(section => {
        const sectionEmployees = employeesStore.employees.filter(emp => emp.section === section)
        const checkedIn = sectionEmployees.filter(emp => 
          attendanceStore.activeEmployees.some(record => 
            record.employeeId === emp.id && record.clockInAt
          )
        ).length
        
        return {
          name: section,
          rate: sectionEmployees.length > 0 ? Math.round((checkedIn / sectionEmployees.length) * 100) : 0
        }
      })
    })
    
    // 이번 달 총 근무 시간
    const totalMonthlyHours = computed(() => {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
      })
      
      const totalMinutes = monthlyRecords.reduce((sum, record) => {
        return sum + (record.workedMinutes || 0)
      }, 0)
      
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      
      return `${hours}시간 ${minutes}분`
    })
    
    // 평균 일일 근무 시간
    const averageDailyHours = computed(() => {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
      })
      
      if (monthlyRecords.length === 0) return '0시간 0분'
      
      const totalMinutes = monthlyRecords.reduce((sum, record) => {
        return sum + (record.workedMinutes || 0)
      }, 0)
      
      const averageMinutes = Math.floor(totalMinutes / monthlyRecords.length)
      const hours = Math.floor(averageMinutes / 60)
      const minutes = averageMinutes % 60
      
      return `${hours}시간 ${minutes}분`
    })
    
    // 가장 활발한 요일
    const mostActiveDayOfWeek = computed(() => {
      const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
      const dayStats = new Array(7).fill(0)
      
      attendanceStore.records.forEach(record => {
        if (record.clockInAt) {
          const dayOfWeek = new Date(record.clockInAt).getDay()
          dayStats[dayOfWeek]++
        }
      })
      
      const maxIndex = dayStats.indexOf(Math.max(...dayStats))
      return dayNames[maxIndex]
    })
    
    // 총 출근 일수
    const totalWorkDays = computed(() => {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonth && 
               recordDate.getFullYear() === currentYear &&
               record.clockInAt
      })
      
      return monthlyRecords.length
    })
    
    return {
      employeesStore,
      attendanceStore,
      weeklyStats,
      sectionStats,
      totalMonthlyHours,
      averageDailyHours,
      mostActiveDayOfWeek,
      totalWorkDays
    }
  },
  methods: {
    formatSection(section) {
      const sections = {
        'HALL': '홀',
        'KITCHEN': '주방'
      }
      return sections[section] || section
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

.analytics-section h2 {
  color: #1f2937;
  margin-bottom: 30px;
}

.chart-section, .department-stats, .monthly-stats {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.chart-section h3, .department-stats h3, .monthly-stats h3 {
  color: #1f2937;
  margin-bottom: 20px;
}

.week-chart {
  display: flex;
  justify-content: space-between;
  align-items: end;
  height: 200px;
  margin-top: 20px;
}

.day-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 80px;
}

.bar {
  width: 40px;
  background: linear-gradient(to top, #3b82f6, #60a5fa);
  border-radius: 4px 4px 0 0;
  min-height: 10px;
  margin-bottom: 8px;
}

.day-label {
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.day-count {
  font-size: 0.8rem;
  color: #6b7280;
}

.dept-chart {
  margin-top: 20px;
}

.dept-item {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.dept-name {
  width: 100px;
  font-weight: 600;
  color: #374151;
}

.dept-progress {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.dept-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s ease;
}

.dept-rate {
  width: 50px;
  text-align: right;
  font-weight: 600;
  color: #374151;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.stat-box {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  border-left: 4px solid #3b82f6;
}

.stat-title {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .week-chart {
    height: 150px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>