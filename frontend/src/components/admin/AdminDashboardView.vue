<template>
  <div class="tab-content">
    <div class="dashboard-grid">
      <!-- 오늘 통계 -->
      <div class="stats-overview">
        <h2>📊 오늘의 현황</h2>
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <span class="stat-number">{{ attendanceStore.todaySummary.totalEmployees }}</span>
              <span class="stat-label">전체 직원</span>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <span class="stat-number">{{ attendanceStore.todaySummary.checkedIn }}</span>
              <span class="stat-label">출근 완료</span>
            </div>
          </div>
          
          <div class="stat-card warning">
            <div class="stat-icon">⏰</div>
            <div class="stat-content">
              <span class="stat-number">{{ attendanceStore.todaySummary.late }}</span>
              <span class="stat-label">지각</span>
            </div>
          </div>
          
          <div class="stat-card error">
            <div class="stat-icon">❌</div>
            <div class="stat-content">
              <span class="stat-number">{{ attendanceStore.todaySummary.absent }}</span>
              <span class="stat-label">결근</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 실시간 출퇴근 현황 -->
      <div class="live-status">
        <h2>🔴 실시간 현황</h2>
        <div class="status-list">
          <div v-if="attendanceStore.activeEmployees.length === 0" class="no-data">
            현재 근무 중인 직원이 없습니다
          </div>
          <div 
            v-else
            v-for="employee in attendanceStore.activeEmployees" 
            :key="employee.employeeId"
            :class="['status-item', 'working']"
          >
            <div class="employee-info">
              <div class="employee-avatar">
                {{ employee.name.charAt(0) }}
              </div>
              <div class="employee-details">
                <span class="employee-name">{{ employee.name }}</span>
                <span class="employee-dept">{{ formatSection(employee.section) }}</span>
              </div>
            </div>
            
            <div class="status-info">
              <StatusBadge status="working" />
              <div class="time-info">
                <span>
                  출근: {{ formatTime(employee.clockInAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 최근 활동 -->
    <div class="recent-activity">
      <h2>📝 최근 출퇴근 활동</h2>
      <div class="activity-list">
        <div v-if="attendanceStore.recentActivities.length === 0" class="no-data">
          최근 출퇴근 활동이 없습니다
        </div>
        <div 
          v-else
          v-for="activity in attendanceStore.recentActivities" 
          :key="activity.id"
          class="activity-item"
        >
          <div class="activity-icon">
            {{ activity.type === 'IN' ? '📥' : '📤' }}
          </div>
          <div class="activity-content">
            <div class="activity-text">
              <strong>{{ activity.name }}</strong>님이 
              <span :class="activity.type === 'IN' ? 'check-in' : 'check-out'">{{ activity.type === 'IN' ? '출근' : '퇴근' }}</span>
              했습니다
            </div>
            <div class="activity-time">{{ formatDateTime(activity.clockInAt || activity.clockOutAt) }}</div>
            <div v-if="activity.workedMinutes !== null" class="work-duration">
              근무시간: {{ formatWorkDuration(activity.workedMinutes) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import StatusBadge from '@/components/StatusBadge.vue'
import { useAttendanceStore } from '@/stores/attendance'

export default {
  name: 'AdminDashboardView',
  components: {
    StatusBadge
  },
  setup() {
    const attendanceStore = useAttendanceStore()
    
    return {
      attendanceStore
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
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    formatDateTime(timestamp) {
      return new Date(timestamp).toLocaleString('ko-KR')
    },
    
    formatWorkDuration(workedMinutes) {
      if (workedMinutes === null || workedMinutes === undefined) return '-'
      
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      
      return `${hours}시간 ${minutes}분`
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

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.stats-overview, .live-status {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stats-overview h2, .live-status h2 {
  margin-bottom: 20px;
  color: #1f2937;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background: #f8fafc;
  border-left: 4px solid #e5e7eb;
}

.stat-card.success {
  border-left-color: #10b981;
}

.stat-card.warning {
  border-left-color: #f59e0b;
}

.stat-card.error {
  border-left-color: #ef4444;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-number {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  font-size: 0.9rem;
  color: #6b7280;
}

.status-list {
  max-height: 400px;
  overflow-y: auto;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.employee-details {
  display: flex;
  flex-direction: column;
}

.employee-name {
  font-weight: 600;
  color: #1f2937;
}

.employee-dept {
  font-size: 0.9rem;
  color: #6b7280;
}

.status-info {
  text-align: right;
}

.time-info {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 4px;
}

.recent-activity {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.activity-list {
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}

.activity-icon {
  font-size: 1.2rem;
  margin-top: 2px;
}

.activity-text .check-in {
  color: #10b981;
  font-weight: 600;
}

.activity-text .check-out {
  color: #f59e0b;
  font-weight: 600;
}

.activity-time {
  font-size: 0.8rem;
  color: #6b7280;
}

.work-duration {
  font-size: 0.8rem;
  color: #059669;
  font-weight: 500;
}

.no-data {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-style: italic;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }
}
</style>