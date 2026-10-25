/**
 * HardwareProvider — WebSocket client connecting React dashboard
 * to the Node.js ESP32 gateway.
 * 
 * Receives real-time telemetry + position updates and exposes them
 * via callbacks for integration into App.jsx.
 */

const DEFAULT_WS_URL = 'ws://localhost:8765';
const RECONNECT_DELAY_MS = 3000;
const STALE_THRESHOLD_MS = 5000;

export class HardwareProvider {
  constructor(wsUrl = DEFAULT_WS_URL) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.deviceConnected = false;
    this.reconnectTimer = null;
    this.lastMessageTs = 0;
    
    // Callbacks
    this.onTelemetry = null;   // (data) => void
    this.onStatus = null;      // (status) => void
    this.onConnect = null;     // () => void
    this.onDisconnect = null;  // () => void
    
    // Latest state
    this.lastTelemetry = null;
    this.lastPosition = null;
    this.messageCount = 0;
  }
  
  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    
    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error('[HW] WebSocket creation failed:', e.message);
      this._scheduleReconnect();
      return;
    }
    
    this.ws.onopen = () => {
      console.log('[HW] Connected to gateway');
      this.connected = true;
      if (this.onConnect) this.onConnect();
    };
    
    this.ws.onmessage = (event) => {
      this.lastMessageTs = Date.now();
      try {
        const data = JSON.parse(event.data);
        this.messageCount++;
        
        if (data.type === 'telemetry') {
          this.lastTelemetry = data;
          this.lastPosition = data.position;
          this.deviceConnected = true;
          if (this.onTelemetry) this.onTelemetry(data);
        }
        
        if (data.type === 'status') {
          this.deviceConnected = data.connected;
          if (this.onStatus) this.onStatus(data);
        }
        
        if (data.type === 'state') {
          this.deviceConnected = data.connected;
          this.lastPosition = data.position;
          if (this.onStatus) this.onStatus(data);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
    
    this.ws.onclose = () => {
      console.log('[HW] Disconnected from gateway');
      this.connected = false;
      this.deviceConnected = false;
      if (this.onDisconnect) this.onDisconnect();
      this._scheduleReconnect();
    };
    
    this.ws.onerror = (err) => {
      console.warn('[HW] WebSocket error');
      // onclose will fire after this
    };
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;  // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.deviceConnected = false;
  }
  
  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[HW] Reconnecting...');
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
  
  isStale() {
    return Date.now() - this.lastMessageTs > STALE_THRESHOLD_MS;
  }
  
  getStatus() {
    return {
      gatewayConnected: this.connected,
      deviceConnected: this.deviceConnected,
      stale: this.isStale(),
      lastMessageAge: Date.now() - this.lastMessageTs,
      messageCount: this.messageCount,
      lastPosition: this.lastPosition,
      lastTelemetry: this.lastTelemetry
    };
  }
}

export default HardwareProvider;
