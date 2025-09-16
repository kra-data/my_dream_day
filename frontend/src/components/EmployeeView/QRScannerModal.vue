<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="qr-code" :size="18" class="inline-block mr-2" />
          QR 코드 스캔
        </h3>
        <button @click="$emit('close')" class="close-btn">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <div class="scanner-instructions">
          <p>QR 코드를 화면 중앙에 맞춰 스캔해주세요</p>
        </div>

        <!-- QR 스캐너 컴포넌트 -->
        <QRScanner @scan-result="handleScanResult" />

        <div class="manual-input-section">
          <p class="manual-input-label">또는 직접 입력:</p>
          <div class="manual-input-group">
            <input
              v-model="manualCode"
              type="text"
              placeholder="QR 코드 입력"
              class="form-control"
              @keyup.enter="handleManualInput"
            >
            <button
              @click="handleManualInput"
              class="btn btn-primary"
              :disabled="!manualCode.trim()"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import QRScanner from '@/components/common/QRScanner.vue'

export default {
  name: 'QRScannerModal',
  components: {
    AppIcon,
    QRScanner
  },
  emits: ['close', 'scan-result'],
  setup(props, { emit }) {
    const manualCode = ref('')

    const handleBackdropClick = () => {
      emit('close')
    }

    const handleScanResult = (result) => {
      emit('scan-result', result)
    }

    const handleManualInput = () => {
      if (manualCode.value.trim()) {
        emit('scan-result', manualCode.value.trim())
        manualCode.value = ''
      }
    }

    return {
      manualCode,
      handleBackdropClick,
      handleScanResult,
      handleManualInput
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 24px;
}

.scanner-instructions {
  text-align: center;
  margin-bottom: 20px;
}

.scanner-instructions p {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.manual-input-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.manual-input-label {
  margin: 0 0 12px 0;
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
}

.manual-input-group {
  display: flex;
  gap: 8px;
}

.form-control {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 20px;
  }

  .manual-input-group {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>