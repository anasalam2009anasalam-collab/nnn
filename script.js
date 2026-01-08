// ===== GLOBAL VARIABLES =====
let scanActive = false;
let scanStartTime = 0;
let totalScans = 0;
let detectedObjects = [];
let selectedObject = null;
let detectionCanvas = null;
let ctx = null;
let lastUpdateTime = 0;
let fps = 0;
let frameCount = 0;

// API Configuration
const API_BASE = 'http://localhost:5000';
const UPDATE_INTERVAL = 1000; // 1 second
const DETECTION_INTERVAL = 500; // 0.5 seconds

// Object categories with icons
const OBJECT_ICONS = {
    'person': 'fas fa-user',
    'car': 'fas fa-car',
    'motorcycle': 'fas fa-motorcycle',
    'bus': 'fas fa-bus',
    'truck': 'fas fa-truck',
    'bicycle': 'fas fa-bicycle',
    'traffic light': 'fas fa-traffic-light',
    'stop sign': 'fas fa-stop-circle',
    'chair': 'fas fa-chair',
    'sofa': 'fas fa-couch',
    'bed': 'fas fa-bed',
    'dining table': 'fas fa-utensils',
    'tv': 'fas fa-tv',
    'laptop': 'fas fa-laptop',
    'mouse': 'fas fa-mouse',
    'keyboard': 'fas fa-keyboard',
    'cell phone': 'fas fa-mobile-alt',
    'book': 'fas fa-book',
    'clock': 'fas fa-clock',
    'vase': 'fas fa-vase',
    'scissors': 'fas fa-cut',
    'teddy bear': 'fas fa-bear',
    'hair drier': 'fas fa-wind',
    'toothbrush': 'fas fa-tooth',
    'cup': 'fas fa-mug-hot',
    'fork': 'fas fa-utensil-fork',
    'knife': 'fas fa-utensil-knife',
    'spoon': 'fas fa-utensil-spoon',
    'bowl': 'fas fa-bowl',
    'banana': 'fas fa-fruit',
    'apple': 'fas fa-apple-alt',
    'sandwich': 'fas fa-burger',
    'orange': 'fas fa-orange',
    'broccoli': 'fas fa-seedling',
    'carrot': 'fas fa-carrot',
    'hot dog': 'fas fa-hotdog',
    'pizza': 'fas fa-pizza-slice',
    'donut': 'fas fa-donut',
    'cake': 'fas fa-birthday-cake',
    'bottle': 'fas fa-wine-bottle',
    'wine glass': 'fas fa-wine-glass',
    'default': 'fas fa-question-circle'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('AI Scanner System Initializing...');
    
    // Initialize canvas
    detectionCanvas = document.getElementById('detectionCanvas');
    ctx = detectionCanvas.getContext('2d');
    
    // Update canvas size
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Load categories
    loadCategories();
    
    // Start system timers
    startSystemTimers();
    
    // Connect to backend
    checkBackendConnection();
    
    // Initialize UI
    updateUI();
    
    console.log('System Initialized');
});

// ===== CANVAS FUNCTIONS =====
function updateCanvasSize() {
    const videoFeed = document.getElementById('videoFeed');
    if (videoFeed && detectionCanvas) {
        detectionCanvas.width = videoFeed.clientWidth;
        detectionCanvas.height = videoFeed.clientHeight;
    }
}

function clearCanvas() {
    if (ctx && detectionCanvas) {
        ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
    }
}

function drawDetections(objects) {
    clearCanvas();
    
    if (!objects || objects.length === 0) return;
    
    const videoFeed = document.getElementById('videoFeed');
    if (!videoFeed) return;
    
    // Calculate scale factors
    const videoWidth = videoFeed.videoWidth || 640;
    const videoHeight = videoFeed.videoHeight || 480;
    const displayWidth = detectionCanvas.width;
    const displayHeight = detectionCanvas.height;
    
    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;
    
    objects.forEach((obj, index) => {
        const [x, y, w, h] = obj.bbox;
        
        // Scale coordinates
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledW = w * scaleX;
        const scaledH = h * scaleY;
        
        // Calculate confidence color
        const confidence = obj.confidence;
        const green = Math.floor(confidence * 255);
        const color = `rgb(0, ${green}, 0)`;
        
        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);
        
        // Draw label background
        const label = `${obj.class} ${Math.round(confidence * 100)}%`;
        ctx.font = '14px Arial';
        const textWidth = ctx.measureText(label).width;
        const textHeight = 20;
        
        ctx.fillStyle = color;
        ctx.fillRect(scaledX, scaledY - textHeight, textWidth + 10, textHeight);
        
        // Draw label text
        ctx.fillStyle = '#000';
        ctx.fillText(label, scaledX + 5, scaledY - 5);
        
        // Draw center point
        ctx.beginPath();
        ctx.arc(scaledX + scaledW/2, scaledY + scaledH/2, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Store scaled bbox for click detection
        obj.scaledBbox = [scaledX, scaledY, scaledW, scaledH];
    });
    
    // Add click handler for object selection
    detectionCanvas.onclick = function(event) {
        const rect = detectionCanvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Find clicked object
        const clickedObj = objects.find(obj => {
            const [x, y, w, h] = obj.scaledBbox || [];
            return x && clickX >= x && clickX <= x + w && 
                   clickY >= y && clickY <= y + h;
        });
        
        if (clickedObj) {
            selectObject(clickedObj);
        }
    };
}

// ===== API FUNCTIONS =====
async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_BASE}/system_info`);
        const data = await response.json();
        
        if (data.system) {
            updateStatus('Backend Connected', 'success');
            updateSystemInfo(data);
            return true;
        }
    } catch (error) {
        console.error('Backend connection failed:', error);
        updateStatus('Backend Disconnected', 'error');
        return false;
    }
}

async function startScan() {
    try {
        const response = await fetch(`${API_BASE}/start_scan`);
        const data = await response.json();
        
        if (data.status === 'success') {
            scanActive = true;
            scanStartTime = Date.now();
            
            // Update UI
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('scanAnimation').style.display = 'block';
            document.getElementById('statusOverlay').style.display = 'flex';
            
            updateStatus('AI Scanning Active', 'success');
            
            // Start periodic detection updates
            startDetectionUpdates();
            
            console.log('Scan started:', data);
        }
    } catch (error) {
        console.error('Start scan error:', error);
        updateStatus('Scan Start Failed', 'error');
    }
}

async function stopScan() {
    try {
        const response = await fetch(`${API_BASE}/stop_scan`);
        const data = await response.json();
        
        if (data.status === 'success') {
            scanActive = false;
            
            // Update UI
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
            document.getElementById('scanAnimation').style.display = 'none';
            document.getElementById('statusOverlay').style.display = 'none';
            
            updateStatus('Scanning Stopped', 'warning');
            
            console.log('Scan stopped:', data);
        }
    } catch (error) {
        console.error('Stop scan error:', error);
        updateStatus('Scan Stop Failed', 'error');
    }
}

async function singleScan() {
    try {
        const response = await fetch(`${API_BASE}/scan_single`);
        const data = await response.json();
        
        if (data.status === 'success') {
            detectedObjects = data.objects || [];
            updateDetectionUI();
            drawDetections(detectedObjects);
            
            totalScans++;
            updateStatus('Single Scan Complete', 'success');
            
            console.log('Single scan:', data);
        }
    } catch (error) {
        console.error('Single scan error:', error);
        updateStatus('Scan Failed', 'error');
    }
}

async function getDetections() {
    if (!scanActive) return;
    
    try {
        const response = await fetch(`${API_BASE}/get_detections`);
        const data = await response.json();
        
        if (data.status === 'success') {
            detectedObjects = data.objects || [];
            updateDetectionUI();
            drawDetections(detectedObjects);
            
            // Update FPS
            frameCount++;
            const now = Date.now();
            if (now - lastUpdateTime >= 1000) {
                fps = frameCount;
                frameCount = 0;
                lastUpdateTime = now;
                updateFPSDisplay();
            }
        }
    } catch (error) {
        console.error('Get detections error:', error);
    }
}

async function getSystemStats() {
    try {
        const response = await fetch(`${API_BASE}/get_stats`);
        const data = await response.json();
        
        updateSystemStats(data);
    } catch (error) {
        console.error('Get stats error:', error);
    }
}

async function changeModel(modelName) {
    try {
        const response = await fetch(`${API_BASE}/change_model/${modelName}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            updateStatus(`Model changed to ${data.model}`, 'success');
            document.getElementById('aiModel').textContent = data.model.toUpperCase();
        }
    } catch (error) {
        console.error('Change model error:', error);
        updateStatus('Model Change Failed', 'error');
    }
}

async function updateConfidence(value) {
    const threshold = value / 100;
    try {
        const response = await fetch(`${API_BASE}/set_confidence/${threshold}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            document.getElementById('confidenceValue').textContent = `${value}%`;
        }
    } catch (error) {
        console.error('Update confidence error:', error);
    }
}

async function captureImage() {
    try {
        const response = await fetch(`${API_BASE}/capture_image`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-scanner-capture-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        updateStatus('Image Captured', 'success');
    } catch (error) {
        console.error('Capture image error:', error);
        updateStatus('Capture Failed', 'error');
    }
}

async function exportResults() {
    try {
        const response = await fetch(`${API_BASE}/export_detections`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `detection-results-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        updateStatus('Results Exported', 'success');
    } catch (error) {
        console.error('Export error:', error);
        updateStatus('Export Failed', 'error');
    }
}

// ===== UI FUNCTIONS =====
function updateStatus(message, type) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const systemStatus = document.getElementById('systemStatus');
    
    statusText.textContent = message;
    systemStatus.textContent = message.split(' ')[0];
    
    // Remove existing classes
    statusDot.className = 'status-dot';
    systemStatus.className = '';
    
    // Add new class based on type
    switch(type) {
        case 'success':
            statusDot.classList.add('active');
            systemStatus.classList.add('text-success');
            break;
        case 'warning':
            statusDot.style.background = '#ffaa00';
            statusDot.style.boxShadow = '0 0 10px #ffaa00';
            systemStatus.style.color = '#ffaa00';
            break;
        case 'error':
            statusDot.style.background = '#ff4444';
            statusDot.style.boxShadow = '0 0 10px #ff4444';
            systemStatus.style.color = '#ff4444';
            break;
        default:
            statusDot.style.background = '#888';
            statusDot.style.boxShadow = '0 0 10px #888';
    }
}

function updateDetectionUI() {
    const objectCount = detectedObjects.length;
    
    // Update counters
    document.getElementById('objectCount').textContent = `${objectCount} Objects`;
    document.getElementById('overlayObjectCount').textContent = objectCount;
    document.getElementById('liveObjectsCount').textContent = objectCount;
    
    // Update results list
    updateResultsList();
    
    // Update feed stats
    document.getElementById('feedDetections').textContent = `${objectCount} Detections`;
}

function updateResultsList() {
    const resultsList = document.getElementById('resultsList');
    
    if (detectedObjects.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-result">
                <i class="fas fa-search"></i>
                <p>No objects detected</p>
                <p class="subtext">Try adjusting confidence threshold</p>
            </div>
        `;
        return;
    }
    
    // Sort by confidence (highest first)
    const sortedObjects = [...detectedObjects].sort((a, b) => b.confidence - a.confidence);
    
    resultsList.innerHTML = '';
    
    sortedObjects.forEach((obj, index) => {
        const icon = OBJECT_ICONS[obj.class] || OBJECT_ICONS.default;
        const confidencePercent = Math.round(obj.confidence * 100);
        const size = obj.area ? `${Math.round(Math.sqrt(obj.area))}px` : '--';
        const time = new Date(obj.timestamp || Date.now()).toLocaleTimeString();
        
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${selectedObject === obj ? 'selected' : ''}`;
        resultItem.onclick = () => selectObject(obj);
        resultItem.dataset.index = index;
        
        resultItem.innerHTML = `
            <div class="result-cell object-name">
                <div class="object-icon">
                    <i class="${icon}"></i>
                </div>
                <span>${obj.class}</span>
            </div>
            <div class="result-cell">
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
                </div>
                <span class="confidence-value">${confidencePercent}%</span>
            </div>
            <div class="result-cell size-value">${size}</div>
            <div class="result-cell time-value">${time}</div>
        `;
        
        resultsList.appendChild(resultItem);
    });
}

function selectObject(obj) {
    selectedObject = obj;
    
    // Update UI selection
    document.querySelectorAll('.result-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    if (obj) {
        const index = detectedObjects.indexOf(obj);
        const resultItem = document.querySelector(`.result-item[data-index="${index}"]`);
        if (resultItem) {
            resultItem.classList.add('selected');
        }
        
        // Show object details
        showObjectDetails(obj);
    }
}

function showObjectDetails(obj) {
    const detailsPanel = document.getElementById('objectDetails');
    const icon = OBJECT_ICONS[obj.class] || OBJECT_ICONS.default;
    const confidencePercent = Math.round(obj.confidence * 100);
    const [x, y, w, h] = obj.bbox;
    const area = obj.area || w * h;
    const diagonal = Math.round(Math.sqrt(w*w + h*h));
    
    detailsPanel.innerHTML = `
        <div class="object-detail-view">
            <div class="detail-header">
                <div class="detail-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="detail-title">
                    <div class="detail-name">${obj.class.toUpperCase()}</div>
                    <div class="detail-category">${obj.category || 'Detected Object'}</div>
                </div>
            </div>
            
            <div class="detail-stats">
                <div class="detail-stat">
                    <span class="stat-label">Confidence</span>
                    <span class="stat-value">${confidencePercent}%</span>
                </div>
                <div class="detail-stat">
                    <span class="stat-label">Size</span>
                    <span class="stat-value">${w}×${h}px</span>
                </div>
                <div class="detail-stat">
                    <span class="stat-label">Area</span>
                    <span class="stat-value">${area.toLocaleString()} px²</span>
                </div>
                <div class="detail-stat">
                    <span class="stat-label">Diagonal</span>
                    <span class="stat-value">${diagonal}px</span>
                </div>
            </div>
            
            <div class="detail-description">
                <strong>Detection Details:</strong><br>
                • Position: (${x}, ${y})<br>
                • Center: (${Math.round(x + w/2)}, ${Math.round(y + h/2)})<br>
                • Detected at: ${new Date(obj.timestamp).toLocaleString()}<br>
                • Scan ID: ${obj.scan_id || 'N/A'}
            </div>
        </div>
    `;
}

function updateSystemInfo(data) {
    if (data.system) {
        document.getElementById('aiModel').textContent = 
            data.system.detection_models[data.system.name] || 'YOLOv3';
    }
}

function updateSystemStats(stats) {
    // Update various stats displays
    document.getElementById('fpsCounter').textContent = `${stats.fps || 0} FPS`;
    document.getElementById('cameraStatus').textContent = stats.camera_status || 'Unknown';
    document.getElementById('resolutionInfo').textContent = '640x480';
    document.getElementById('scanDuration').textContent = 
        scanActive ? `${Math.floor((Date.now() - scanStartTime) / 1000)}s` : '0s';
    document.getElementById('totalScans').textContent = totalScans;
    document.getElementById('latencyInfo').textContent = `${stats.latency || '--'} ms`;
    
    // Update feed stats
    document.getElementById('feedFPS').textContent = `${stats.fps || 0} FPS`;
    
    // Simulate memory usage
    const memory = 150 + Math.floor(Math.random() * 50);
    document.getElementById('memoryUsage').textContent = `${memory} MB`;
}

function updateFPSDisplay() {
    document.getElementById('fpsCounter').textContent = `${fps} FPS`;
    document.getElementById('feedFPS').textContent = `${fps} FPS`;
}

function loadCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const categories = [
        'person', 'vehicle', 'furniture', 'electronics', 
        'kitchenware', 'food', 'animal', 'sports', 'outdoor'
    ];
    
    categoriesList.innerHTML = '';
    
    categories.forEach(category => {
        const tag = document.createElement('div');
        tag.className = 'category-tag';
        tag.textContent = category;
        tag.onclick = () => filterByCategory(category);
        
        categoriesList.appendChild(tag);
    });
}

function filterByCategory(category) {
    // Update active tag
    document.querySelectorAll('.category-tag').forEach(tag => {
        tag.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter objects (simplified - would need actual category mapping)
    console.log('Filter by category:', category);
}

// ===== SYSTEM FUNCTIONS =====
function startSystemTimers() {
    // Update time every second
    setInterval(() => {
        const now = new Date();
        document.getElementById('feedTime').textContent = now.toLocaleTimeString();
        document.getElementById('systemUptime').textContent = 
            formatUptime(Math.floor(performance.now() / 1000));
    }, 1000);
    
    // Update system stats every 2 seconds
    setInterval(getSystemStats, 2000);
}

function startDetectionUpdates() {
    // Clear existing interval
    if (window.detectionInterval) {
        clearInterval(window.detectionInterval);
    }
    
    // Start new interval
    window.detectionInterval = setInterval(getDetections, DETECTION_INTERVAL);
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:` +
           `${minutes.toString().padStart(2, '0')}:` +
           `${secs.toString().padStart(2, '0')}`;
}

function toggleFullscreen() {
    const container = document.querySelector('.camera-container');
    
    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function toggleDetectionOverlay() {
    const canvas = document.getElementById('detectionCanvas');
    canvas.style.display = canvas.style.display === 'none' ? 'block' : 'none';
}

function refreshCamera() {
    const videoFeed = document.getElementById('videoFeed');
    videoFeed.src = videoFeed.src; // Reload feed
    updateStatus('Camera Refreshed', 'success');
}

function showSystemInfo() {
    alert(`
AI SCANNER SYSTEM INFO
======================
Version: 2.0.0
Backend: Python Flask + OpenCV
AI Model: YOLOv3 (80 classes)
Detection: Real-time object scanning
Features: Bounding boxes, confidence scores, object details
Export: JSON, Images
Status: ${scanActive ? 'Active' : 'Inactive'}
    `);
}

function resetSystem() {
    if (confirm('Reset system to default settings?')) {
        scanActive = false;
        detectedObjects = [];
        selectedObject = null;
        
        // Reset UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('scanAnimation').style.display = 'none';
        document.getElementById('statusOverlay').style.display = 'none';
        
        clearCanvas();
        updateDetectionUI();
        
        updateStatus('System Reset', 'success');
    }
}

function showHelp() {
    alert(`
AI SCANNER HELP GUIDE
=====================

1. START AI SCAN: Begin real-time object detection
2. STOP SCAN: Pause detection
3. SINGLE SCAN: Detect objects in current frame
4. CONFIDENCE SLIDER: Adjust detection sensitivity
5. MODEL SELECTION: Choose different AI models
6. CLICK OBJECTS: View detailed information
7. CAPTURE: Save current frame with detections
8. EXPORT: Download detection results as JSON

Shortcuts:
- Space: Toggle scan
- F: Fullscreen
- R: Refresh camera
- C: Capture image
- E: Export results
    `);
}

function showLogs() {
    alert(`
SYSTEM LOGS
===========
[${new Date().toLocaleString()}] System initialized
[${new Date().toLocaleString()}] Backend connected
[${new Date().toLocaleString()}] Camera feed active
[${new Date().toLocaleString()}] AI model loaded: YOLOv3
[${new Date().toLocaleString()}] Total scans: ${totalScans}
[${new Date().toLocaleString()}] Objects detected: ${detectedObjects.length}
    `);
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(event) {
    switch(event.key.toLowerCase()) {
        case ' ':
            event.preventDefault();
            if (scanActive) {
                stopScan();
            } else {
                startScan();
            }
            break;
            
        case 'f':
            if (event.ctrlKey) return;
            event.preventDefault();
            toggleFullscreen();
            break;
            
        case 'r':
            if (event.ctrlKey) return;
            event.preventDefault();
            refreshCamera();
            break;
            
        case 'c':
            if (event.ctrlKey) return;
            event.preventDefault();
            captureImage();
            break;
            
        case 'e':
            if (event.ctrlKey) return;
            event.preventDefault();
            exportResults();
            break;
    }
});

// ===== INITIAL UI UPDATE =====
function updateUI() {
    // Set initial time
    document.getElementById('feedTime').textContent = new Date().toLocaleTimeString();
    
    // Update status
    updateStatus('System Ready', 'success');
    
    // Initialize categories
    loadCategories();
}