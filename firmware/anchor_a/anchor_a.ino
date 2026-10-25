/*
 * ESP32 Wi-Fi Anchor A — Indoor Positioning System
 * Creates a Wi-Fi Access Point with SSID "INDOOR_ANCHOR_A"
 * The tracker ESP32 scans for this SSID and measures RSSI.
 * 
 * Hardware: Any ESP32 development board
 * No additional sensors required.
 */

#include <WiFi.h>

const char* ANCHOR_SSID = "INDOOR_ANCHOR_A";
const char* ANCHOR_PASS = "";  // Open AP (no password)
const int   CHANNEL     = 1;   // Wi-Fi channel

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== INDOOR POSITIONING: ANCHOR A ===");
  Serial.print("Starting AP with SSID: ");
  Serial.println(ANCHOR_SSID);
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ANCHOR_SSID, ANCHOR_PASS, CHANNEL, 0, 4);
  
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Anchor A is broadcasting. Do not move this device.");
}

void loop() {
  // Anchors are passive — they only broadcast.
  // Print station count every 10 seconds for diagnostics.
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 10000) {
    lastPrint = millis();
    Serial.print("[ANCHOR_A] Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Connected stations: ");
    Serial.println(WiFi.softAPgetStationNum());
  }
  delay(100);
}
