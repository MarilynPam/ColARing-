// Analytics tracking for WebAR Coloring Book
class ARAnalytics {
  constructor() {
    this.sessionStart = Date.now();
    this.metrics = {
      sessionId: this.generateSessionId(),
      sessionStart: new Date().toISOString(),
      deviceInfo: this.getDeviceInfo(),
      detectionEvents: [],
      interactions: {
        taps: 0,
        rotations: 0,
        captures: 0,
        resets: 0
      },
      detectionTimes: [],
      detectionFailures: 0,
      targetStats: {
        mermaid: { found: 0, lost: 0, totalVisibleTime: 0, lastFoundTime: null },
        turtle: { found: 0, lost: 0, totalVisibleTime: 0, lastFoundTime: null },
        goku: { found: 0, lost: 0, totalVisibleTime: 0, lastFoundTime: null }
      },
      brightness: [],
      captureAttempts: {
        successful: 0,
        failed: 0
      }
    };
    
    this.currentTarget = null;
    this.detectionStartTime = null;
    this.isTracking = false;
    
    this.init();
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'Unknown';
    let os = 'Unknown';
    let browser = 'Unknown';
    
    // Device type
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
    else deviceType = 'Desktop';
    
    // OS
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/mac/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    
    // Browser
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/edg/i.test(ua)) browser = 'Edge';
    
    return {
      userAgent: ua,
      deviceType,
      os,
      browser,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1
    };
  }
  
  async measureBrightness() {
    try {
      const video = document.querySelector('video');
      if (!video) return null;
      
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Calculate perceived brightness
        sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      
      const brightness = sum / (canvas.width * canvas.height);
      return Math.round(brightness);
    } catch (error) {
      console.warn('Brightness measurement failed:', error);
      return null;
    }
  }
  
  init() {
    console.log('Analytics initialized');
    this.isTracking = true;
    
    // Track brightness every 5 seconds
    this.brightnessInterval = setInterval(async () => {
      const brightness = await this.measureBrightness();
      if (brightness !== null) {
        this.metrics.brightness.push({
          timestamp: Date.now() - this.sessionStart,
          value: brightness
        });
      }
    }, 5000);
    
    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
    
    // Track gestures and interactions
    this.trackInteractions();
    
    // Export on page unload
    window.addEventListener('beforeunload', () => {
      this.exportCSV(true);
    });
  }
  
  trackInteractions() {
    // Track taps
    document.addEventListener('touchstart', () => {
      this.metrics.interactions.taps++;
    });
    
    document.addEventListener('click', () => {
      this.metrics.interactions.taps++;
    });
    
    // Track device orientation changes (rotations)
    if (window.DeviceOrientationEvent) {
      let lastOrientation = null;
      window.addEventListener('deviceorientation', (event) => {
        if (lastOrientation === null) {
          lastOrientation = event.alpha;
          return;
        }
        
        const change = Math.abs(event.alpha - lastOrientation);
        if (change > 30) {
          this.metrics.interactions.rotations++;
          lastOrientation = event.alpha;
        }
      });
    }
  }
  
  trackTargetFound(targetName, targetIndex) {
    const now = Date.now();
    
    if (!this.detectionStartTime) {
      this.detectionStartTime = now;
    }
    
    const detectionTime = now - this.sessionStart;
    this.metrics.detectionTimes.push(detectionTime);
    
    this.currentTarget = targetName;
    
    const stats = this.metrics.targetStats[targetName];
    if (stats) {
      stats.found++;
      stats.lastFoundTime = now;
    }
    
    this.metrics.detectionEvents.push({
      type: 'found',
      target: targetName,
      targetIndex,
      timestamp: detectionTime,
      sessionTime: this.getSessionDuration()
    });
    
    console.log(`Analytics: ${targetName} found`);
  }
  
  trackTargetLost(targetName, targetIndex) {
    const now = Date.now();
    const detectionTime = now - this.sessionStart;
    
    const stats = this.metrics.targetStats[targetName];
    if (stats) {
      stats.lost++;
      if (stats.lastFoundTime) {
        const visibleDuration = now - stats.lastFoundTime;
        stats.totalVisibleTime += visibleDuration;
        stats.lastFoundTime = null;
      }
    }
    
    this.metrics.detectionEvents.push({
      type: 'lost',
      target: targetName,
      targetIndex,
      timestamp: detectionTime,
      sessionTime: this.getSessionDuration()
    });
    
    if (this.currentTarget === targetName) {
      this.currentTarget = null;
    }
    
    console.log(`Analytics: ${targetName} lost`);
  }
  
  trackDetectionFailure() {
    this.metrics.detectionFailures++;
    console.log('Analytics: Detection failure');
  }
  
  trackCapture(success = true) {
    if (success) {
      this.metrics.captureAttempts.successful++;
      this.metrics.interactions.captures++;
    } else {
      this.metrics.captureAttempts.failed++;
    }
    console.log(`Analytics: Capture ${success ? 'successful' : 'failed'}`);
  }
  
  trackReset() {
    this.metrics.interactions.resets++;
    console.log('Analytics: Texture reset');
  }
  
  pauseTracking() {
    this.isTracking = false;
  }
  
  resumeTracking() {
    this.isTracking = true;
  }
  
  getSessionDuration() {
    return Date.now() - this.sessionStart;
  }
  
  getAverageDetectionTime() {
    if (this.metrics.detectionTimes.length === 0) return 0;
    const sum = this.metrics.detectionTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.detectionTimes.length);
  }
  
  getAverageBrightness() {
    if (this.metrics.brightness.length === 0) return 0;
    const sum = this.metrics.brightness.reduce((a, b) => a + b.value, 0);
    return Math.round(sum / this.metrics.brightness.length);
  }
  
  generateCSV() {
    const sessionDuration = this.getSessionDuration();
    const avgDetectionTime = this.getAverageDetectionTime();
    const avgBrightness = this.getAverageBrightness();
    
    // Main metrics CSV
    const headers = [
      'Session ID',
      'Session Start',
      'Session Duration (ms)',
      'Session Duration (min)',
      'Device Type',
      'OS',
      'Browser',
      'Screen Width',
      'Screen Height',
      'Pixel Ratio',
      'Avg Detection Time (ms)',
      'Detection Failures',
      'Total Taps',
      'Total Rotations',
      'Total Captures',
      'Total Resets',
      'Total Interactions',
      'Successful Captures',
      'Failed Captures',
      'Avg Brightness',
      'Mermaid Found Count',
      'Mermaid Lost Count',
      'Mermaid Total Visible Time (ms)',
      'Turtle Found Count',
      'Turtle Lost Count',
      'Turtle Total Visible Time (ms)',
      'Goku Found Count',
      'Goku Lost Count',
      'Goku Total Visible Time (ms)'
    ];
    
    const totalInteractions = 
      this.metrics.interactions.taps + 
      this.metrics.interactions.rotations + 
      this.metrics.interactions.captures + 
      this.metrics.interactions.resets;
    
    const row = [
      this.metrics.sessionId,
      this.metrics.sessionStart,
      sessionDuration,
      (sessionDuration / 60000).toFixed(2),
      this.metrics.deviceInfo.deviceType,
      this.metrics.deviceInfo.os,
      this.metrics.deviceInfo.browser,
      this.metrics.deviceInfo.screenWidth,
      this.metrics.deviceInfo.screenHeight,
      this.metrics.deviceInfo.pixelRatio,
      avgDetectionTime,
      this.metrics.detectionFailures,
      this.metrics.interactions.taps,
      this.metrics.interactions.rotations,
      this.metrics.interactions.captures,
      this.metrics.interactions.resets,
      totalInteractions,
      this.metrics.captureAttempts.successful,
      this.metrics.captureAttempts.failed,
      avgBrightness,
      this.metrics.targetStats.mermaid.found,
      this.metrics.targetStats.mermaid.lost,
      this.metrics.targetStats.mermaid.totalVisibleTime,
      this.metrics.targetStats.turtle.found,
      this.metrics.targetStats.turtle.lost,
      this.metrics.targetStats.turtle.totalVisibleTime,
      this.metrics.targetStats.goku.found,
      this.metrics.targetStats.goku.lost,
      this.metrics.targetStats.goku.totalVisibleTime
    ];
    
    const csv = headers.join(',') + '\n' + row.join(',');
    return csv;
  }
  
  generateDetailedEventsCSV() {
    const headers = ['Event Type', 'Target', 'Target Index', 'Timestamp (ms)', 'Session Time (ms)'];
    const rows = this.metrics.detectionEvents.map(event => [
      event.type,
      event.target,
      event.targetIndex,
      event.timestamp,
      event.sessionTime
    ]);
    
    return headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  }
  
  generateBrightnessCSV() {
    const headers = ['Timestamp (ms)', 'Brightness Value'];
    const rows = this.metrics.brightness.map(b => [b.timestamp, b.value]);
    
    return headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  }
  
  exportCSV(auto = false) {
    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar_analytics_${this.metrics.sessionId}.csv`;
    
    if (!auto) {
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    
    URL.revokeObjectURL(url);
    console.log('Analytics exported');
  }
  
  exportDetailedEvents() {
    const csv = this.generateDetailedEventsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar_events_${this.metrics.sessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  exportBrightnessData() {
    const csv = this.generateBrightnessCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar_brightness_${this.metrics.sessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  printSummary() {
    console.log('=== AR Analytics Summary ===');
    console.log('Session Duration:', (this.getSessionDuration() / 60000).toFixed(2), 'minutes');
    console.log('Avg Detection Time:', this.getAverageDetectionTime(), 'ms');
    console.log('Detection Failures:', this.metrics.detectionFailures);
    console.log('Total Taps:', this.metrics.interactions.taps);
    console.log('Total Rotations:', this.metrics.interactions.rotations);
    console.log('Total Captures:', this.metrics.interactions.captures);
    console.log('Avg Brightness:', this.getAverageBrightness());
    console.log('Device:', this.metrics.deviceInfo.deviceType, this.metrics.deviceInfo.os, this.metrics.deviceInfo.browser);
    console.log('===========================');
  }
}

// Initialize analytics
const arAnalytics = new ARAnalytics();

// Make it globally accessible
window.arAnalytics = arAnalytics;