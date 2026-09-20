/**
 * Hardware Abstraction Layer: SensorProvider
 *
 * Provides a clean interface for sensor feeds so that the simulation
 * can be replaced by real hardware (WebSerial / MQTT / BLE) without
 * altering the EKF, Trilateration, or PLE algorithms.
 */

export class SensorProvider {
  /**
   * Retrieves high-frequency 6-DoF IMU data
   * @returns {Object} { ax, ay, az, gx, gy, gz, timestamp }
   */
  getIMUData() {
    throw new Error('getIMUData() must be implemented by concrete subclass');
  }

  /**
   * Retrieves low-frequency LoRa packet containing RSSI from anchor nodes
   * @returns {Array} Array of { anchorId, rssi, timestamp }
   */
  getLoRaData() {
    throw new Error('getLoRaData() must be implemented by concrete subclass');
  }
}

/**
 * In-browser Simulated Sensor Provider
 */
export class SimulationSensorProvider extends SensorProvider {
  constructor() {
    super();
    this.currentIMU = { ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, timestamp: Date.now() };
    this.currentLoRa = [];
  }

  updateSensors(imu, lora) {
    this.currentIMU = { ...imu, timestamp: Date.now() };
    this.currentLoRa = lora || [];
  }

  getIMUData() {
    return this.currentIMU;
  }

  getLoRaData() {
    return this.currentLoRa;
  }
}

/**
 * WebSerial Hardware Sensor Provider (Production Deployment Template)
 * Connects directly to an ESP32 or STM32 transmitting JSON telemetry over USB.
 */
export class WebSerialSensorProvider extends SensorProvider {
  constructor(baudRate = 115200) {
    super();
    this.baudRate = baudRate;
    this.port = null;
    this.reader = null;
    this.lastIMU = { ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, timestamp: Date.now() };
    this.lastLoRa = [];
  }

  async connect() {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported in this browser.');
    }
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: this.baudRate });
    this._readLoop();
  }

  async _readLoop() {
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    let buffer = '';
    while (true) {
      const { value, done } = await this.reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial

      for (const line of lines) {
        try {
          const packet = JSON.parse(line.trim());
          if (packet.type === 'IMU') {
            this.lastIMU = { ...packet.data, timestamp: Date.now() };
          } else if (packet.type === 'LORA') {
            this.lastLoRa = packet.data;
          }
        } catch {
          // Ignore partial or corrupted serial packets
        }
      }
    }
  }

  getIMUData() {
    return this.lastIMU;
  }

  getLoRaData() {
    return this.lastLoRa;
  }
}