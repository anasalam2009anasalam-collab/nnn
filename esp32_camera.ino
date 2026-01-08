#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClient.h>

// Camera pins for AI Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// WiFi credentials
const char* ssid = "ESP32-CAM-SCANNER";
const char* password = "12345678";

WebServer server(80);

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== AI Object Scanner ESP32-CAM ===");
  
  // Initialize camera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Adjust resolution for performance
  config.frame_size = FRAMESIZE_VGA;  // 640x480
  config.jpeg_quality = 12;
  config.fb_count = 1;
  
  // Camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }
  
  Serial.println("Camera initialized");
  
  // Start WiFi Access Point
  WiFi.softAP(ssid, password);
  Serial.println("\nWiFi Access Point Started");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("Password: ");
  Serial.println(password);
  Serial.print("IP Address: ");
  Serial.println(WiFi.softAPIP());
  
  // Define server routes
  server.on("/", HTTP_GET, []() {
    String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Scanner</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #000; 
            color: #0f0; 
            font-family: monospace; 
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            text-align: center; 
        }
        h1 { 
            color: #0f0; 
            text-shadow: 0 0 10px #0f0; 
        }
        img { 
            width: 100%; 
            max-width: 640px; 
            border: 3px solid #0f0; 
            border-radius: 10px; 
            margin: 20px 0; 
            box-shadow: 0 0 20px rgba(0,255,0,0.3); 
        }
        .controls { 
            margin: 20px 0; 
        }
        button { 
            background: #0f0; 
            color: #000; 
            border: none; 
            padding: 12px 24px; 
            margin: 0 10px; 
            border-radius: 5px; 
            cursor: pointer; 
            font-weight: bold; 
            font-family: monospace; 
        }
        button:hover { 
            background: #0a0; 
            transform: scale(1.05); 
        }
        .status { 
            margin-top: 20px; 
            padding: 10px; 
            background: rgba(0,255,0,0.1); 
            border-radius: 5px; 
            border: 1px solid #0f0; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📡 ESP32-CAM AI SCANNER</h1>
        <div class="status">
            <p>📶 Connected to: ESP32-CAM-SCANNER</p>
            <p>🔗 Use this IP with Python scanner: )rawliteral";
    html += WiFi.softAPIP().toString();
    html += R"rawliteral(</p>
        </div>
        
        <div class="controls">
            <button onclick="window.location.href='/stream'">🎥 VIEW STREAM</button>
            <button onclick="captureImage()">📷 CAPTURE IMAGE</button>
            <button onclick="window.location.href='/control?var=framesize&val=10'">📐 HIGH RES</button>
            <button onclick="window.location.href='/control?var=framesize&val=5'">📐 LOW RES</button>
        </div>
        
        <img src="/capture" id="captureImage" alt="Camera Capture">
        
        <div class="status">
            <p>⚡ System Ready for AI Object Scanning</p>
            <p>💡 Connect to Python backend for full AI detection</p>
        </div>
    </div>
    
    <script>
        function captureImage() {
            const img = document.getElementById('captureImage');
            img.src = '/capture?t=' + new Date().getTime();
            
            // Auto-refresh every 2 seconds
            setInterval(() => {
                img.src = '/capture?t=' + new Date().getTime();
            }, 2000);
        }
        
        // Start auto-refresh
        setTimeout(captureImage, 1000);
    </script>
</body>
</html>
    )rawliteral";
    server.send(200, "text/html", html);
  });
  
  server.on("/stream", HTTP_GET, []() {
    String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Live Stream</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 0; background: #000; }
        img { width: 100%; height: 100vh; object-fit: contain; }
    </style>
</head>
<body>
    <img src="/stream">
    
    <script>
        // Auto-refresh stream
        setInterval(() => {
            const img = document.querySelector('img');
            img.src = '/stream?t=' + new Date().getTime();
        }, 100);
    </script>
</body>
</html>
    )rawliteral";
    server.send(200, "text/html", html);
  });
  
  server.on("/capture", HTTP_GET, []() {
    camera_fb_t * fb = NULL;
    esp_err_t res = ESP_OK;
    
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      server.send(500, "text/plain", "Camera capture failed");
      return;
    }
    
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    server.sendHeader("Pragma", "no-cache");
    server.sendHeader("Expires", "-1");
    server.sendHeader("Content-Length", String(fb->len));
    server.send(200, "image/jpeg", "");
    
    WiFiClient client = server.client();
    client.write(fb->buf, fb->len);
    
    esp_camera_fb_return(fb);
  });
  
  server.on("/stream", HTTP_GET, []() {
    WiFiClient client = server.client();
    
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
    client.println("Access-Control-Allow-Origin: *");
    client.println();
    
    while (client.connected()) {
      camera_fb_t * fb = esp_camera_fb_get();
      if (!fb) {
        Serial.println("Camera capture failed");
        break;
      }
      
      client.print("--frame\r\n");
      client.print("Content-Type: image/jpeg\r\n\r\n");
      client.write(fb->buf, fb->len);
      client.print("\r\n");
      
      esp_camera_fb_return(fb);
      delay(100); // ~10 FPS
    }
  });
  
  server.on("/control", HTTP_GET, []() {
    String var = server.arg("var");
    String val = server.arg("val");
    
    if (var == "framesize") {
      sensor_t * s = esp_camera_sensor_get();
      s->set_framesize(s, (framesize_t)val.toInt());
      server.send(200, "text/plain", "Resolution changed");
    } else {
      server.send(404, "text/plain", "Invalid control");
    }
  });
  
  server.on("/status", HTTP_GET, []() {
    String json = "{";
    json += "\"status\":\"online\",";
    json += "\"ip\":\"" + WiFi.softAPIP().toString() + "\",";
    json += "\"camera\":\"connected\",";
    json += "\"clients\":" + String(WiFi.softAPgetStationNum()) + ",";
    json += "\"uptime\":" + String(millis() / 1000);
    json += "}";
    server.send(200, "application/json", json);
  });
  
  // Start server
  server.begin();
  Serial.println("HTTP server started");
  Serial.println("Open browser to: http://" + WiFi.softAPIP().toString());
  Serial.println("Ready for AI Object Scanning!");
}

void loop() {
  server.handleClient();
  delay(1);
}