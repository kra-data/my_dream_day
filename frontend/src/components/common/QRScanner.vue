<template>
  <div class="qr-scanner">
    <div class="scanner-container">
      <video 
        ref="videoElement" 
        class="scanner-video"
        autoplay 
        playsinline
      ></video>
      <div class="scanner-overlay">
        <div class="scan-frame"></div>
      </div>
    </div>
    
    <div class="scanner-controls">
      <button 
        @click="toggleScanner"
        class="btn-primary"
      >
        {{ isScanning ? '스캔 중지' : '스캔 시작' }}
      </button>
      
      <button 
        @click="switchCamera"
        class="btn-secondary"
        v-if="hasMultipleCameras"
      >
        카메라 전환
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import QrScanner from 'qr-scanner'

export default {
  name: 'QRScanner',
  emits: ['scan-result'],
  data() {
    return {
      scanner: null,
      isScanning: false,
      hasMultipleCameras: false,
      error: null
    }
  },
  mounted() {
    this.checkCameraSupport()
  },
  beforeUnmount() {
    this.cleanupScanner()
  },

  // 중복 마운트 방지
  activated() {
    if (!this.scanner) {
      this.checkCameraSupport()
    }
  },

  deactivated() {
    this.cleanupScanner()
  },
  methods: {
    async checkCameraSupport() {
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) {
          this.error = '카메라를 찾을 수 없습니다'
          return
        }
        
        const cameras = await QrScanner.listCameras(true)
        this.hasMultipleCameras = cameras.length > 1
        
        this.initScanner()
      } catch {
        this.error = '카메라 접근 권한이 필요합니다'
      }
    },
    
    initScanner() {
      this.scanner = new QrScanner(
        this.$refs.videoElement,
        result => this.handleScanResult(result),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )
    },
    
    handleScanResult(result) {
      this.$emit('scan-result', result.data)
      // 스캔 후 스캐너 중지 (모달이 닫히기 때문에 재시작 불필요)
      this.stopScanner()
    },
    
    toggleScanner() {
      if (this.isScanning) {
        this.stopScanner()
      } else {
        this.startScanner()
      }
    },
    
    startScanner() {
      if (this.scanner && !this.isScanning) {
        try {
          this.scanner.start()
          this.isScanning = true
          this.error = null
        } catch (error) {
          console.error('스캐너 시작 실패:', error)
          this.error = '스캐너를 시작할 수 없습니다. 다시 시도해주세요.'
          // 스캐너 재시작 시도
          this.restartScanner()
        }
      }
    },
    
    stopScanner() {
      if (this.scanner && this.isScanning) {
        try {
          this.scanner.stop()
          this.isScanning = false
        } catch (error) {
          console.warn('스캐너 중지 실패:', error)
          this.isScanning = false
        }
      }
    },
    
    async switchCamera() {
      if (this.scanner && this.isScanning) {
        try {
          await this.scanner.setCamera('environment')
        } catch (error) {
          console.warn('카메라 전환 실패:', error)
          this.error = '카메라 전환에 실패했습니다'
        }
      }
    },

    // 스캐너 정리 함수 추가
    cleanupScanner() {
      if (this.scanner) {
        try {
          this.stopScanner()
          this.scanner.destroy()
        } catch (error) {
          console.warn('스캐너 정리 중 오류:', error)
        }
        this.scanner = null
        this.isScanning = false
      }
    },

    // 스캐너 재시작 함수
    restartScanner() {
      this.cleanupScanner()
      setTimeout(() => {
        this.checkCameraSupport()
      }, 100)
    }
  }
}
</script>

<style scoped>
.qr-scanner {
  max-width: 400px;
  margin: 0 auto;
}

.scanner-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}

.scanner-video {
  width: 100%;
  height: 300px;
  object-fit: cover;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-frame {
  width: 200px;
  height: 200px;
  border: 2px solid #10b981;
  border-radius: 8px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.scanner-controls {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-primary {
  flex: 1;
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary {
  padding: 12px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.error-message {
  margin-top: 12px;
  padding: 12px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  text-align: center;
}
</style>