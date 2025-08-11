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
    if (this.scanner) {
      this.scanner.destroy()
    }
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
      } catch (err) {
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
      // 스캔 후 잠시 멈추기
      this.stopScanner()
      setTimeout(() => {
        if (this.scanner) {
          this.startScanner()
        }
      }, 2000)
    },
    
    toggleScanner() {
      if (this.isScanning) {
        this.stopScanner()
      } else {
        this.startScanner()
      }
    },
    
    startScanner() {
      if (this.scanner) {
        this.scanner.start()
        this.isScanning = true
        this.error = null
      }
    },
    
    stopScanner() {
      if (this.scanner) {
        this.scanner.stop()
        this.isScanning = false
      }
    },
    
    async switchCamera() {
      if (this.scanner) {
        await this.scanner.setCamera('environment')
      }
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