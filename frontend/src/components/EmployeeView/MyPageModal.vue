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
              <span class="info-value">{{ overviewData?.name || '정보 없음' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">구역</span>
              <span class="info-value">{{ formatSection(overviewData?.section) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">직위</span>
              <span class="info-value">{{ formatPosition(overviewData?.position) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">급여</span>
              <span class="info-value">{{ formatPay(overviewData?.pay, overviewData?.payUnit) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">휴대폰</span>
              <span class="info-value">{{ overviewData?.phone || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">은행 계좌</span>
              <div class="bank-info">
                <span class="bank-name">{{ overviewData?.bank || '정보 없음' }}</span>
                <span v-if="overviewData?.accountNumber" class="account-number">{{ overviewData.accountNumber }}</span>
                <span v-if="!overviewData?.accountNumber" class="bank-warning"><AppIcon name="warning" :size="16" class="mr-1" />계좌 등록 필요</span>
                <span v-else class="bank-registered"><AppIcon name="check" :size="16" class="mr-1" />등록완료</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 정산 정보 -->
        <div class="settlement-section">
          <h4><AppIcon name="currency" :size="18" class="mr-2" />정산 정보</h4>
          <div class="settlement-card">
            <div class="settlement-amounts">
              <!-- 지난달 정산 금액 -->
              <div class="amount-row settled">
                <span class="amount-icon"><AppIcon name="success" :size="16" /></span>
                <div class="amount-content">
                  <span class="amount-label">지난달 정산 금액</span>
                  <span class="amount-value">{{ formatCurrency(overviewData?.lastMonthSettlementAmount || 0) }}</span>
                </div>
                <div class="amount-status">
                  <span class="status-badge completed">정산완료</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 이번 달 급여 정보 -->
        <div class="salary-section">
          <h4><AppIcon name="money" :size="18" class="mr-2" />{{ getCurrentMonthLabel() }} 급여 정보</h4>
          <div class="salary-card">
            <div class="salary-item">
              <span class="salary-label">총 근무 시간</span>
              <span class="salary-value">{{ formatWorkingHours(overviewData?.thisMonth?.workedMinutes) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">예상 총 급여</span>
              <span class="salary-value">{{ formatCurrency(overviewData?.expectedTotalPay || 0) }}</span>
            </div>
            <div class="salary-item">
              <span class="salary-label">공제 금액</span>
              <span class="salary-value deduction">{{ formatCurrency(overviewData?.deductionAmount || 0) }}</span>
            </div>
            <div class="salary-item total">
              <span class="salary-label">예상 실수령액</span>
              <span class="salary-value">{{ formatCurrency(overviewData?.expectedNetPay || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 근무 통계 -->
        <div class="stats-section">
          <h4><AppIcon name="chart" :size="18" class="mr-2" />근무 통계</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ overviewData?.thisMonth?.workedHours || 0 }}</span>
              <span class="stat-label">총 근무시간</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ Math.round((overviewData?.thisMonth?.workedHours || 0) / 8) || 0 }}</span>
              <span class="stat-label">추정 근무일</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ overviewData?.thisMonth?.workedMinutes || 0 }}</span>
              <span class="stat-label">총 근무분</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ Math.round((overviewData?.thisMonth?.workedMinutes || 0) / 60 * 100) / 100 || 0 }}</span>
              <span class="stat-label">정확한 시간</span>
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
import AppIcon from '@/components/common/AppIcon.vue'

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
    const overviewData = ref(null)
    const loading = ref(false)

    // 개요 정보 로드
    const loadOverviewInfo = async () => {
      loading.value = true
      try {
        const data = await attendanceStore.fetchMyOverview()
        overviewData.value = data
        console.log('개요 정보 로드 성공:', data)
      } catch (error) {
        console.error('개요 정보 로드 실패:', error)
        // 기본값 설정
        overviewData.value = {
          id: 0,
          name: '정보 없음',
          section: 'UNKNOWN',
          position: 'UNKNOWN',
          pay: null,
          payUnit: 'HOURLY',
          phone: '-',
          accountNumber: '',
          bank: '정보 없음',
          lastMonthSettlementAmount: null,
          thisMonth: {
            workedMinutes: 0,
            workedHours: 0
          },
          expectedTotalPay: 0,
          deductionAmount: 0,
          expectedNetPay: 0
        }
      } finally {
        loading.value = false
      }
    }

    // 현재 달 라벨
    const getCurrentMonthLabel = () => {
      const now = new Date()
      return `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    }

    // 모달이 열릴 때 개요 정보 로드
    watch(() => props.show, (newShow) => {
      if (newShow) {
        loadOverviewInfo()
      }
    })

    return {
      overviewData,
      loading,
      loadOverviewInfo,
      getCurrentMonthLabel
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
  emits: ['close']
}
</script>
<style scoped src="@/assets/styles/components/EmployeeView/MyPageModal.css"></style>