/*
 * ESP32 Wi-Fi Anchor B — Indoor Positioning System
 * Creates a Wi-Fi Access Point with SSID "INDOOR_ANCHOR_B"
 */

#include <WiFi.h>

const char* ANCHOR_SSID = "INDOOR_ANCHOR_B";
const char* ANCHOR_PASS = "";
const int   CHANNEL     = 6;  // Different channel to reduce interference

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== INDOOR POSITIONING: ANCHOR B ===");
  Serial.print("Starting AP with SSID: ");
  Serial.println(ANCHOR_SSID);
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ANCHOR_SSID, ANCHOR_PASS, CHANNEL, 0, 4);
  
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Anchor B is broadcasting. Do not move this device.");
}

void loop() {
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 10000) {
    lastPrint = millis();
    Serial.print("[ANCHOR_B] Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Connected stations: ");
    Serial.println(WiFi.softAPgetStationNum());
  }
  delay(100);
}
