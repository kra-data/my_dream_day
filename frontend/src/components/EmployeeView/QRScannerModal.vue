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

<style scoped src="@/assets/styles/components/EmployeeView/QRScannerModal.css"></style>