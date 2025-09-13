<template>
  <!-- QR 스캔 모달 -->
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content qr-modal" @click.stop>
      <div class="modal-header">
        <h3>
          <AppIcon name="qr" :size="18" class="inline-block mr-2" />
          {{ action === 'check-in' ? '출근 QR 스캔' : '퇴근 QR 스캔' }}
        </h3>
        <button @click="$emit('close')" class="modal-close">&times;</button>
      </div>
      
      <div class="qr-scan-content">
        <div class="scan-tabs">
          <button 
            @click="activeTab = 'camera'"
            :class="['tab-btn', { 'active': activeTab === 'camera' }]"
          >
            <AppIcon name="eye" :size="16" class="mr-1" />
            카메라 스캔
          </button>
          <button 
            @click="activeTab = 'manual'"
            :class="['tab-btn', { 'active': activeTab === 'manual' }]"
          >
            <AppIcon name="keyboard" :size="16" class="mr-1" />
            수동 입력
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
              <AppIcon name="camera" :size="16" class="mr-1" />카메라 시작
            </button>
            <button 
              v-else
              @click="stopCamera" 
              class="btn btn-secondary btn-base"
            >
              <AppIcon name="stop" :size="16" class="mr-1" />카메라 정지
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
              <AppIcon :name="scanResult.type === 'success' ? 'check-circle' : 'x-circle'" :size="18" />
            </div>
            <div>{{ scanResult.message }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'QRModal',
  components: { AppIcon },
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

<style scoped src="@/assets/styles/employee/QRModal.css"></style>
