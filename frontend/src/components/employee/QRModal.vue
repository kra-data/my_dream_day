<template>
  <!-- QR 스캔 모달 -->
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content qr-modal" @click.stop>
      <div class="modal-header">
        <h3>
          {{ action === 'check-in' ? '📱 출근 QR 스캔' : '📱 퇴근 QR 스캔' }}
        </h3>
        <button @click="$emit('close')" class="modal-close">&times;</button>
      </div>
      
      <div class="qr-scan-content">
        <p class="qr-instruction">
          본인의 QR 코드를 카메라에 비춰주세요
        </p>
        
        <div class="manual-qr-input">
          <input 
            type="text" 
            v-model="manualQRCode"
            placeholder="QR 코드 입력 (임시)"
            class="form-control"
          >
          <button 
            @click="handleQRScan" 
            class="btn btn-primary btn-base"
            :class="{ 'btn-loading': loading }"
            :disabled="!manualQRCode || loading"
            style="width: 100%;"
          >
            <span v-if="!loading">확인</span>
            <span v-else>처리 중...</span>
          </button>
        </div>
        
        <div v-if="scanResult" class="scan-result">
          <div :class="['alert', `alert-${scanResult.type}`, 'alert-icon']">
            <div class="alert-icon-content">
              {{ scanResult.type === 'success' ? '✅' : '❌' }}
            </div>
            <div>{{ scanResult.message }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QRModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    action: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    },
    scanResult: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      manualQRCode: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.manualQRCode = '2' // 기본값 설정
      } else {
        this.manualQRCode = ''
      }
    }
  },
  methods: {
    handleQRScan() {
      this.$emit('qr-scan', this.manualQRCode)
    }
  },
  emits: ['close', 'qr-scan']
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
}

.modal-content {
  @apply card;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
}

.qr-modal {
  padding: var(--space-6);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  color: var(--color-text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--text-2xl);
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-base);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

.qr-scan-content {
  text-align: center;
}

.qr-instruction {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  margin-bottom: var(--space-6);
}

.manual-qr-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.scan-result {
  margin-top: var(--space-5);
}

/* 반응형 디자인 */
@media (max-width: 480px) {
  .modal-content {
    width: 95%;
  }
  
  .qr-modal {
    padding: var(--space-4);
  }
  
  .manual-qr-input {
    gap: var(--space-2);
  }
}
</style>