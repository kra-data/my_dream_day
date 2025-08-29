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
        <h3>📊 월별 근무 통계 ({{ currentMonth }}월)</h3>
        <div class="stats-grid">
          <div class="stat-box primary">
            <div class="stat-icon">⏰</div>
            <div class="stat-title">이번 달 총 근무 시간</div>
            <div class="stat-value">{{ totalMonthlyHours.display }}</div>
            <div class="stat-subtitle">{{ totalMonthlyHours.minutes }}분</div>
          </div>
          <div class="stat-box success">
            <div class="stat-icon">📈</div>
            <div class="stat-title">평균 일일 근무 시간</div>
            <div class="stat-value">{{ averageDailyHours.display }}</div>
            <div class="stat-subtitle">직원 1명당 평균</div>
          </div>
          <div class="stat-box warning">
            <div class="stat-icon">⭐</div>
            <div class="stat-title">가장 활발한 요일</div>
            <div class="stat-value">{{ mostActiveDayOfWeek.day }}</div>
            <div class="stat-subtitle">{{ mostActiveDayOfWeek.count }}회 출근</div>
          </div>
          <div class="stat-box info">
            <div class="stat-icon">📅</div>
            <div class="stat-title">총 출근 일수</div>
            <div class="stat-value">{{ totalWorkDays }}일</div>
            <div class="stat-subtitle">{{ workingDaysInMonth }}일 중</div>
          </div>
        </div>

        <!-- 추가 세부 통계 -->
        <div class="detailed-stats">
          <h4>📋 세부 통계</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">출근률</span>
              <span class="detail-value">{{ attendanceRate }}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">연장 근무</span>
              <span class="detail-value">{{ overtimeHours }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">지각 횟수</span>
              <span class="detail-value">{{ lateCount }}회</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">평균 급여</span>
              <span class="detail-value">{{ avgMonthlySalary }}</span>
            </div>
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
    
    // 현재 달
    const currentMonth = computed(() => {
      return new Date().getMonth() + 1
    })

    // 현재 달의 근무일 수 계산
    const workingDaysInMonth = computed(() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      
      let workingDays = 0
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
        const dayOfWeek = date.getDay()
        // 주말 제외 (일요일 0, 토요일 6)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++
        }
      }
      return workingDays
    })
    
    // 이번 달 총 근무 시간 (개선됨)
    const totalMonthlyHours = computed(() => {
      const currentMonthNum = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonthNum && recordDate.getFullYear() === currentYear
      })
      
      const totalMinutes = monthlyRecords.reduce((sum, record) => {
        if (record.workedMinutes && record.workedMinutes > 0) {
          return sum + record.workedMinutes
        }
        // workedMinutes가 없으면 clockIn/clockOut으로 계산
        if (record.clockInAt && record.clockOutAt) {
          const start = new Date(record.clockInAt)
          const end = new Date(record.clockOutAt)
          const diffMinutes = Math.floor((end - start) / (1000 * 60))
          return sum + Math.max(0, diffMinutes)
        }
        return sum
      }, 0)
      
      const hours = Math.floor(totalMinutes / 60)
      const remainingMinutes = totalMinutes % 60
      
      return {
        display: totalMinutes > 0 ? `${hours}시간` : '0시간',
        minutes: totalMinutes,
        hours: hours
      }
    })
    
    // 평균 일일 근무 시간 (개선됨)
    const averageDailyHours = computed(() => {
      const currentMonthNum = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonthNum && 
               recordDate.getFullYear() === currentYear &&
               record.clockInAt
      })
      
      if (monthlyRecords.length === 0) {
        return { display: '0시간', minutes: 0 }
      }
      
      const totalMinutes = totalMonthlyHours.value.minutes
      const averageMinutes = Math.floor(totalMinutes / monthlyRecords.length)
      const hours = Math.floor(averageMinutes / 60)
      const minutes = averageMinutes % 60
      
      return {
        display: averageMinutes > 0 ? `${hours}시간 ${minutes}분` : '0시간',
        minutes: averageMinutes
      }
    })
    
    // 가장 활발한 요일 (개선됨)
    const mostActiveDayOfWeek = computed(() => {
      const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
      const dayStats = new Array(7).fill(0)
      
      attendanceStore.records.forEach(record => {
        if (record.clockInAt) {
          const dayOfWeek = new Date(record.clockInAt).getDay()
          dayStats[dayOfWeek]++
        }
      })
      
      const maxCount = Math.max(...dayStats)
      const maxIndex = dayStats.indexOf(maxCount)
      
      return {
        day: maxCount > 0 ? dayNames[maxIndex] : '데이터 없음',
        count: maxCount
      }
    })
    
    // 총 출근 일수
    const totalWorkDays = computed(() => {
      const currentMonthNum = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonthNum && 
               recordDate.getFullYear() === currentYear &&
               record.clockInAt
      })
      
      return monthlyRecords.length
    })

    // 출근률 계산
    const attendanceRate = computed(() => {
      if (employeesStore.employees.length === 0 || workingDaysInMonth.value === 0) return 0
      
      const expectedWorkDays = employeesStore.employees.length * workingDaysInMonth.value
      const actualWorkDays = totalWorkDays.value
      
      return Math.round((actualWorkDays / expectedWorkDays) * 100)
    })

    // 연장 근무 시간
    const overtimeHours = computed(() => {
      const currentMonthNum = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonthNum && recordDate.getFullYear() === currentYear
      })
      
      const overtimeMinutes = monthlyRecords.reduce((sum, record) => {
        const workedMinutes = record.workedMinutes || 0
        // 8시간(480분) 초과 근무를 연장 근무로 간주
        const overtime = Math.max(0, workedMinutes - 480)
        return sum + overtime
      }, 0)
      
      const hours = Math.floor(overtimeMinutes / 60)
      return hours > 0 ? `${hours}시간` : '0시간'
    })

    // 지각 횟수
    const lateCount = computed(() => {
      const currentMonthNum = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyRecords = attendanceStore.records.filter(record => {
        const recordDate = new Date(record.clockInAt || record.date)
        return recordDate.getMonth() === currentMonthNum && 
               recordDate.getFullYear() === currentYear &&
               record.clockInAt
      })
      
      return monthlyRecords.filter(record => {
        const clockInTime = new Date(record.clockInAt)
        const hour = clockInTime.getHours()
        const minute = clockInTime.getMinutes()
        // 9시 이후를 지각으로 간주
        return hour > 9 || (hour === 9 && minute > 0)
      }).length
    })

    // 평균 월급 계산
    const avgMonthlySalary = computed(() => {
      if (employeesStore.employees.length === 0) return '0원'
      
      const totalSalary = employeesStore.employees.reduce((sum, employee) => {
        if (employee.payUnit === 'MONTHLY') {
          return sum + employee.pay
        } else if (employee.payUnit === 'HOURLY') {
          // 시급을 월급으로 환산 (월 160시간 기준)
          return sum + (employee.pay * 160)
        }
        return sum
      }, 0)
      
      const average = Math.floor(totalSalary / employeesStore.employees.length)
      return `${average.toLocaleString()}원`
    })
    
    return {
      employeesStore,
      attendanceStore,
      currentMonth,
      weeklyStats,
      sectionStats,
      workingDaysInMonth,
      totalMonthlyHours,
      averageDailyHours,
      mostActiveDayOfWeek,
      totalWorkDays,
      attendanceRate,
      overtimeHours,
      lateCount,
      avgMonthlySalary
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
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  border: 2px solid #e2e8f0;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat-box:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.stat-box.primary {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.stat-box.success {
  border-color: #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.stat-box.warning {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.stat-box.info {
  border-color: #6366f1;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.stat-icon {
  font-size: 2rem;
  margin-bottom: 8px;
  display: block;
}

.stat-title {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.stat-subtitle {
  font-size: 0.8rem;
  color: #9ca3af;
  font-weight: 400;
}

/* 세부 통계 스타일 */
.detailed-stats {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #e2e8f0;
}

.detailed-stats h4 {
  color: #1e293b;
  margin-bottom: 16px;
  font-size: 1.1rem;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.detail-label {
  font-weight: 500;
  color: #64748b;
  font-size: 0.9rem;
}

.detail-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 1rem;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .detail-grid {
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
  
  .stat-value {
    font-size: 1.5rem;
  }
  
  .stat-icon {
    font-size: 1.5rem;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>