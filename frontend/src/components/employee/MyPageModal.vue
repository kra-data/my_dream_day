<template>
  <!-- 마이페이지 모달 -->
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content mypage-modal" @click.stop>
      <div class="modal-header">
        <h3><AppIcon name="stats" :size="20" class="mr-2" />마이페이지</h3>
        <button @click="$emit('close')" class="modal-close">&times;</button>
      </div>
      
      <div class="mypage-content">
        <!-- 개인 정보 -->
        <div class="info-section">
          <h4><AppIcon name="user" :size="18" class="mr-2" />개인 정보</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">이름</span>
              <span class="info-value">{{ settlementData?.profile?.name || '정보 없음' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">구역</span>
              <span class="info-value">{{ formatSection(settlementData?.profile?.section) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">직위</span>
              <span class="info-value">{{ formatPosition(settlementData?.profile?.position) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">급여</span>
              <span class="info-value">{{ formatPay(settlementData?.profile?.pay, settlementData?.profile?.payUnit) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">휴대폰</span>
              <span class="info-value">{{ settlementData?.profile?.phoneMasked || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">은행</span>
              <div class="bank-info">
                <span class="bank-name">{{ settlementData?.profile?.bank || '정보 없음' }}</span>
                <span v-if="!settlementData?.profile?.bankRegistered" class="bank-warning"><AppIcon name="warning" :size="16" class="mr-1" />계좌 등록 필요</span>
                <span v-else class="bank-registered"><AppIcon name="check" :size="16" class="mr-1" />등록완료</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 정산 정보 -->
        <div class="settlement-section">
          <h4><AppIcon name="currency" :size="18" class="mr-2" />정산 정보</h4>
          <div class="settlement-card">
            <div class="settlement-period-info">
              <div class="period-badge current">
                <span class="period-title">현재 정산 기간</span>
                <span class="period-date">{{ settlementData?.cycle?.label || '-' }}</span>
              </div>
            </div>
            
            <div class="settlement-amounts">
              <!-- 정산 완료된 금액만 표시 -->
              <div class="amount-row settled">
                <span class="amount-icon"><AppIcon name="success" :size="16" /></span>
                <div class="amount-content">
                  <span class="amount-label">이전 사이클 정산 금액</span>
                  <span class="amount-value">{{ formatCurrency(settlementData?.cards?.previous?.amount || 0) }}</span>
                </div>
                <div class="amount-status">
                  <span class="status-badge" :class="getStatusClass(settlementData?.cards?.previous?.status)">
                    {{ getStatusText(settlementData?.cards?.previous?.status) }}
                  </span>
                  <span v-if="settlementData?.cards?.previous?.settledAt" class="settlement-date">
                    {{ formatSettlementDate(settlementData?.cards?.previous?.settledAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 이번 달 급여 정보 -->
        <div class="salary-section">
          <h4><AppIcon name="money" :size="18" class="mr-2" />{{ settlementData?.month?.year }}년 {{ settlementData?.month?.month }}월 급여 정보</h4>
          <div class="salary-card">
            <div class="salary-item">
              <span class="salary-label">총 근무 시간</span>
              <span class="salary-value">{{ formatWorkingHours(settlementData?.month?.workedMinutes) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">기본 급여</span>
              <span class="salary-value">{{ formatCurrency(settlementData?.month?.basePay || 0) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">추가 수당</span>
              <span class="salary-value">{{ formatCurrency((settlementData?.month?.totalPay || 0) - (settlementData?.month?.basePay || 0)) }}</span>
            </div>
            <div class="salary-item total">
              <span class="salary-label">예상 총 급여</span>
              <span class="salary-value">{{ formatCurrency(settlementData?.month?.totalPay || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 출근 통계 -->
        <div class="stats-section">
          <h4><AppIcon name="chart" :size="18" class="mr-2" />출근 통계</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.presentDays || 0 }}</span>
              <span class="stat-label">출근일</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.lateCount || 0 }}</span>
              <span class="stat-label">지각</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ settlementData?.stats?.absentCount || 0 }}</span>
              <span class="stat-label">결근</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ Math.round((settlementData?.month?.workedHours || 0) / 8) || 0 }}</span>
              <span class="stat-label">추정 출근일</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { useAttendanceStore } from '@/stores/attendance'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'MyPageModal',
  components: {
    AppIcon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const attendanceStore = useAttendanceStore()
    const settlementData = ref(null)
    const loading = ref(false)


    // 정산 정보 로드
    const loadSettlementInfo = async () => {
      loading.value = true
      try {
        const data = await attendanceStore.fetchMySettlement()
        settlementData.value = data
        console.log('정산 정보 로드 성공:', data)
      } catch (error) {
        console.error('정산 정보 로드 실패:', error)
        // 기본값 설정
        settlementData.value = {
          profile: {
            name: '정보 없음',
            section: 'UNKNOWN',
            position: 'UNKNOWN',
            pay: 0,
            payUnit: 'MONTHLY',
            phoneMasked: '-',
            bank: '정보 없음',
            bankRegistered: false
          },
          cycle: {
            label: '-'
          },
          cards: {
            current: { amount: 0, status: 'PENDING' },
            previous: { amount: 0, status: 'PAID' }
          },
          month: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            workedMinutes: 0,
            workedHours: 0,
            basePay: 0,
            totalPay: 0
          },
          stats: {
            presentDays: 0,
            lateCount: 0,
            absentCount: 0
          }
        }
      } finally {
        loading.value = false
      }
    }

    // 모달이 열릴 때 정산 정보 로드
    watch(() => props.show, (newShow) => {
      if (newShow) {
        loadSettlementInfo()
      }
    })

    return {
      settlementData,
      loading,
      loadSettlementInfo
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
        'OWNER': '오너',
        'MANAGER': '매니저',
        'STAFF': '스태프',
        'PART_TIME': '아르바이트'
      }
      return positions[position] || position
    },

    formatPay(pay, payUnit) {
      if (!pay) return '정보 없음'
      const unit = payUnit === 'HOURLY' ? '시급' : '월급'
      return `${pay.toLocaleString()}원 (${unit})`
    },

    formatWorkingHours(workedMinutes) {
      if (!workedMinutes) return '0시간 0분'
      const hours = Math.floor(workedMinutes / 60)
      const minutes = workedMinutes % 60
      return `${hours}시간 ${minutes}분`
    },

    getStatusClass(status) {
      const statusClasses = {
        'PENDING': 'pending',
        'PAID': 'completed',
        'PROCESSING': 'processing',
        'CANCELLED': 'cancelled'
      }
      return statusClasses[status] || 'pending'
    },

    getStatusText(status) {
      const statusTexts = {
        'PENDING': '미정산',
        'PAID': '정산완료',
        'PROCESSING': '정산중',
        'CANCELLED': '취소'
      }
      return statusTexts[status] || '알 수 없음'
    },

    formatCurrency(amount) {
      if (!amount && amount !== 0) return '0원'
      return `${amount.toLocaleString('ko-KR')}원`
    },

    formatSettlementDate(dateString) {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric'
      }) + ' 정산'
    }
  },
  watch: {
    show(newShow) {
      if (newShow) {
        this.loadSettlementInfo()
      }
    }
  },
  emits: ['close']
}
</script>

<style scoped src="@/assets/styles/employee/MyPageModal.css"></style>
