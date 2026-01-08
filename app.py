from flask import Flask, Response, jsonify, render_template
from flask_cors import CORS
import cv2
import numpy as np
import threading
import time
import json
from datetime import datetime
import logging
from object_detector import ObjectDetector
from camera_handler import CameraHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='../frontend')
CORS(app)

# Initialize components
detector = ObjectDetector()
camera = CameraHandler()

# Global variables
detected_objects = []
frame_lock = threading.Lock()
scan_active = False
last_scan_time = time.time()

# Available detection models
DETECTION_MODELS = {
    'yolov4': 'YOLOv4 (Fastest)',
    'yolov3': 'YOLOv3 (Balanced)',
    'ssd_mobilenet': 'SSD MobileNet (Lightweight)',
    'faster_rcnn': 'Faster R-CNN (Most Accurate)'
}

# Object categories with descriptions
OBJECT_CATEGORIES = {
    'person': 'Human Being',
    'car': 'Vehicle - Car',
    'motorcycle': 'Vehicle - Motorcycle',
    'bus': 'Vehicle - Bus',
    'truck': 'Vehicle - Truck',
    'bicycle': 'Vehicle - Bicycle',
    'traffic light': 'Traffic Signal',
    'stop sign': 'Road Sign - Stop',
    'chair': 'Furniture - Chair',
    'sofa': 'Furniture - Sofa',
    'bed': 'Furniture - Bed',
    'dining table': 'Furniture - Table',
    'tv': 'Electronics - Television',
    'laptop': 'Electronics - Laptop',
    'mouse': 'Electronics - Computer Mouse',
    'keyboard': 'Electronics - Keyboard',
    'cell phone': 'Electronics - Mobile Phone',
    'book': 'Stationery - Book',
    'clock': 'Decor - Clock',
    'vase': 'Decor - Vase',
    'scissors': 'Tool - Scissors',
    'teddy bear': 'Toy - Teddy Bear',
    'hair drier': 'Appliance - Hair Dryer',
    'toothbrush': 'Personal Care - Toothbrush',
    'cup': 'Kitchenware - Cup',
    'fork': 'Kitchenware - Fork',
    'knife': 'Kitchenware - Knife',
    'spoon': 'Kitchenware - Spoon',
    'bowl': 'Kitchenware - Bowl',
    'banana': 'Food - Banana',
    'apple': 'Food - Apple',
    'sandwich': 'Food - Sandwich',
    'orange': 'Food - Orange',
    'broccoli': 'Food - Broccoli',
    'carrot': 'Food - Carrot',
    'hot dog': 'Food - Hot Dog',
    'pizza': 'Food - Pizza',
    'donut': 'Food - Donut',
    'cake': 'Food - Cake',
    'bottle': 'Container - Bottle',
    'wine glass': 'Container - Wine Glass',
    'cup': 'Container - Cup',
    'fork': 'Utensil - Fork',
    'knife': 'Utensil - Knife',
    'spoon': 'Utensil - Spoon'
}

def generate_frames():
    """Generate video frames with object detection"""
    global detected_objects, scan_active
    
    while True:
        try:
            # Get frame from camera
            frame = camera.get_frame()
            
            if frame is None:
                # Send black frame if no camera
                black_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(black_frame, "NO CAMERA FEED", (200, 240), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                ret, buffer = cv2.imencode('.jpg', black_frame)
                frame_bytes = buffer.tobytes()
            else:
                # Perform object detection if active
                if scan_active:
                    detected = detector.detect_objects(frame)
                    
                    with frame_lock:
                        detected_objects = detected
                        last_scan_time = time.time()
                    
                    # Draw detection results on frame
                    frame = detector.draw_detections(frame, detected)
                
                # Encode frame
                ret, buffer = cv2.imencode('.jpg', frame, 
                                         [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_bytes = buffer.tobytes()
            
            # Yield frame for streaming
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + 
                   frame_bytes + b'\r\n')
            
            # Control frame rate
            time.sleep(0.033)  # ~30 FPS
            
        except Exception as e:
            logger.error(f"Frame generation error: {e}")
            time.sleep(1)

@app.route('/')
def index():
    """Serve main HTML page"""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_scan')
def start_scan():
    """Start object scanning"""
    global scan_active
    scan_active = True
    logger.info("Object scanning started")
    return jsonify({
        'status': 'success',
        'message': 'AI Scanning Started',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/stop_scan')
def stop_scan():
    """Stop object scanning"""
    global scan_active
    scan_active = False
    logger.info("Object scanning stopped")
    return jsonify({
        'status': 'success',
        'message': 'AI Scanning Stopped',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/get_detections')
def get_detections():
    """Get current detected objects"""
    with frame_lock:
        objects = detected_objects.copy()
    
    # Enrich object data with categories
    enriched_objects = []
    for obj in objects:
        category = OBJECT_CATEGORIES.get(obj['class'], 'Unknown Object')
        enriched_objects.append({
            **obj,
            'category': category,
            'scan_time': datetime.now().isoformat()
        })
    
    return jsonify({
        'status': 'success',
        'count': len(enriched_objects),
        'objects': enriched_objects,
        'scan_active': scan_active,
        'last_scan': last_scan_time
    })

@app.route('/scan_single')
def scan_single():
    """Perform single frame scan"""
    frame = camera.get_frame()
    if frame is not None:
        detected = detector.detect_objects(frame)
        
        with frame_lock:
            detected_objects = detected
            last_scan_time = time.time()
        
        return jsonify({
            'status': 'success',
            'count': len(detected),
            'objects': detected,
            'timestamp': datetime.now().isoformat()
        })
    
    return jsonify({
        'status': 'error',
        'message': 'No camera frame available'
    })

@app.route('/get_stats')
def get_stats():
    """Get system statistics"""
    with frame_lock:
        obj_count = len(detected_objects)
    
    return jsonify({
        'objects_detected': obj_count,
        'scan_active': scan_active,
        'uptime': time.time() - start_time,
        'fps': camera.get_fps(),
        'camera_status': 'connected' if camera.is_connected() else 'disconnected',
        'model': detector.get_current_model(),
        'confidence_threshold': detector.confidence_threshold
    })

@app.route('/change_model/<model_name>')
def change_model(model_name):
    """Change detection model"""
    if model_name in DETECTION_MODELS:
        success = detector.load_model(model_name)
        if success:
            return jsonify({
                'status': 'success',
                'message': f'Model changed to {DETECTION_MODELS[model_name]}',
                'model': model_name
            })
    
    return jsonify({
        'status': 'error',
        'message': 'Invalid model name'
    })

@app.route('/set_confidence/<float:threshold>')
def set_confidence(threshold):
    """Set confidence threshold"""
    if 0 <= threshold <= 1:
        detector.confidence_threshold = threshold
        return jsonify({
            'status': 'success',
            'message': f'Confidence threshold set to {threshold:.2f}',
            'threshold': threshold
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Threshold must be between 0 and 1'
    })

@app.route('/export_detections')
def export_detections():
    """Export detection results as JSON"""
    with frame_lock:
        objects = detected_objects.copy()
    
    export_data = {
        'export_time': datetime.now().isoformat(),
        'total_objects': len(objects),
        'objects': objects,
        'scan_duration': time.time() - last_scan_time if scan_active else 0
    }
    
    return Response(
        json.dumps(export_data, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': 'attachment;filename=detections.json'}
    )

@app.route('/capture_image')
def capture_image():
    """Capture current frame with detections"""
    frame = camera.get_frame()
    if frame is not None and scan_active:
        frame = detector.draw_detections(frame, detected_objects)
    
    if frame is None:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add timestamp and info
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(frame, f"AI Scanner - {timestamp}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    
    if scan_active:
        cv2.putText(frame, f"Objects: {len(detected_objects)}", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    
    ret, buffer = cv2.imencode('.jpg', frame)
    
    return Response(
        buffer.tobytes(),
        mimetype='image/jpeg',
        headers={'Content-Disposition': 'attachment;filename=capture.jpg'}
    )

@app.route('/system_info')
def system_info():
    """Get detailed system information"""
    return jsonify({
        'system': {
            'name': 'AI Object Scanner System',
            'version': '2.0.0',
            'python_version': '3.8+',
            'opencv_version': cv2.__version__,
            'detection_models': DETECTION_MODELS,
            'object_categories': len(OBJECT_CATEGORIES)
        },
        'hardware': {
            'camera_available': camera.is_connected(),
            'camera_resolution': camera.get_resolution(),
            'gpu_available': cv2.cuda.getCudaEnabledDeviceCount() > 0
        },
        'status': {
            'scanning': scan_active,
            'objects_in_memory': len(detected_objects),
            'uptime_seconds': time.time() - start_time
        }
    })

if __name__ == '__main__':
    start_time = time.time()
    
    # Try to initialize camera
    if not camera.initialize():
        logger.warning("Camera initialization failed. Using fallback mode.")
    
    # Load default detection model
    detector.load_model('yolov3')
    
    logger.info("Starting AI Scanner System...")
    logger.info(f"Available models: {list(DETECTION_MODELS.keys())}")
    logger.info(f"Object categories: {len(OBJECT_CATEGORIES)}")
    logger.info("Server running on http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)