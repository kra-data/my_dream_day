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
        <div class="scan-tabs">
          <button 
            @click="activeTab = 'camera'"
            :class="['tab-btn', { 'active': activeTab === 'camera' }]"
          >
            📹 카메라 스캔
          </button>
          <button 
            @click="activeTab = 'manual'"
            :class="['tab-btn', { 'active': activeTab === 'manual' }]"
          >
            ⌨️ 수동 입력
          </button>
        </div>

        <!-- 카메라 스캔 탭 -->
        <div v-if="activeTab === 'camera'" class="camera-scan">
          <p class="qr-instruction">
            QR 코드를 카메라에 비춰주세요
          </p>
          
          <div class="camera-container">
            <video ref="video" class="camera-preview" autoplay muted playsinline></video>
            <div class="camera-overlay">
              <div class="scan-frame"></div>
            </div>
          </div>
          
          <div class="camera-controls">
            <button 
              v-if="!cameraActive"
              @click="startCamera" 
              class="btn btn-primary btn-base"
              :disabled="loading"
            >
              📹 카메라 시작
            </button>
            <button 
              v-else
              @click="stopCamera" 
              class="btn btn-secondary btn-base"
            >
              🛑 카메라 정지
            </button>
          </div>

          <div v-if="cameraError" class="camera-error">
            <div class="alert alert-error">
              {{ cameraError }}
            </div>
          </div>
        </div>

        <!-- 수동 입력 탭 -->
        <div v-if="activeTab === 'manual'" class="manual-scan">
          <p class="qr-instruction">
            QR 코드 번호를 직접 입력하세요
          </p>
          
          <div class="manual-qr-input">
            <input 
              type="text" 
              v-model="manualQRCode"
              placeholder="QR 코드 번호를 입력하세요"
              class="form-control"
              @keyup.enter="handleManualScan"
            >
            <button 
              @click="handleManualScan" 
              class="btn btn-primary btn-base"
              :class="{ 'btn-loading': loading }"
              :disabled="!manualQRCode || loading"
              style="width: 100%;"
            >
              <span v-if="!loading">확인</span>
              <span v-else>처리 중...</span>
            </button>
          </div>
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
      activeTab: 'camera',
      manualQRCode: '',
      cameraActive: false,
      cameraError: null,
      stream: null,
      qrReader: null
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.activeTab = 'camera'
        this.manualQRCode = ''
        this.cameraError = null
      } else {
        this.stopCamera()
        this.manualQRCode = ''
        this.cameraError = null
      }
    },
    activeTab(newTab) {
      if (newTab !== 'camera') {
        this.stopCamera()
      }
    }
  },
  mounted() {
    // QR 스캔 라이브러리 동적 로드
    this.loadQRLibrary()
  },
  beforeUnmount() {
    this.stopCamera()
  },
  methods: {
    async loadQRLibrary() {
      try {
        // jsQR 라이브러리 CDN으로 로드
        if (!window.jsQR) {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
          script.onload = () => {
            console.log('QR 라이브러리 로드 완료')
          }
          document.head.appendChild(script)
        }
      } catch (error) {
        console.error('QR 라이브러리 로드 실패:', error)
      }
    },

    async startCamera() {
      try {
        this.cameraError = null
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment', // 후면 카메라 우선
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          })
          
          this.$refs.video.srcObject = this.stream
          this.cameraActive = true
          
          // QR 스캔 시작
          this.startQRDetection()
        } else {
          throw new Error('카메라를 지원하지 않는 브라우저입니다')
        }
      } catch (error) {
        console.error('카메라 시작 실패:', error)
        this.cameraError = '카메라에 접근할 수 없습니다. 권한을 허용해주세요.'
        this.cameraActive = false
      }
    },

    stopCamera() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop()
        })
        this.stream = null
      }
      this.cameraActive = false
      
      if (this.qrReader) {
        clearInterval(this.qrReader)
        this.qrReader = null
      }
    },

    startQRDetection() {
      if (!window.jsQR) {
        this.cameraError = 'QR 스캔 라이브러리가 로드되지 않았습니다'
        return
      }

      const video = this.$refs.video
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      this.qrReader = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight
          canvas.width = video.videoWidth
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height)
          
          if (qrCode) {
            console.log('QR 코드 감지:', qrCode.data)
            this.handleCameraScan(qrCode.data)
            this.stopCamera()
          }
        }
      }, 300) // 300ms마다 스캔
    },

    handleCameraScan(qrData) {
      if (qrData) {
        this.$emit('qr-scan', qrData)
      }
    },

    handleManualScan() {
      if (this.manualQRCode) {
        this.$emit('qr-scan', this.manualQRCode)
      }
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
  z-index: 9999;
}

.modal-content {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 450px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
}

.qr-modal {
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #9ca3af;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.modal-close:hover {
  color: #6b7280;
  background: #f3f4f6;
}

.qr-scan-content {
  text-align: center;
}

.scan-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-btn:hover:not(.active) {
  color: #374151;
}

.qr-instruction {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 24px;
}

.camera-container {
  position: relative;
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}

.camera-preview {
  width: 100%;
  height: 280px;
  object-fit: cover;
  display: block;
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-frame {
  width: 200px;
  height: 200px;
  border: 3px solid #3b82f6;
  border-radius: 12px;
  position: relative;
  animation: scan-pulse 2s infinite;
}

.scan-frame::before,
.scan-frame::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid #ffffff;
}

.scan-frame::before {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
}

.scan-frame::after {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
}

@keyframes scan-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.camera-controls {
  margin-bottom: 16px;
}

.camera-error {
  margin-top: 16px;
}

.manual-qr-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.form-control {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-base {
  font-size: 14px;
}

.btn-loading {
  position: relative;
}

.scan-result {
  margin-top: 20px;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.alert-success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.alert-error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.alert-icon-content {
  font-size: 18px;
}

/* 다크 모드 지원 */

/* 반응형 디자인 */
@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    margin: 20px;
  }
  
  .qr-modal {
    padding: 16px;
  }
  
  .camera-preview {
    height: 240px;
  }
  
  .scan-frame {
    width: 160px;
    height: 160px;
  }
  
  .tab-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  /* 모바일 다크 모드 지원 */
}
</style>