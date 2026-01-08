import cv2
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ObjectDetector:
    def __init__(self):
        self.net = None
        self.classes = []
        self.confidence_threshold = 0.5
        self.nms_threshold = 0.4
        self.current_model = None
        self.colors = None
        
        # Load COCO class names
        self.load_coco_classes()
        
        # Generate random colors for each class
        np.random.seed(42)
        self.colors = np.random.randint(0, 255, size=(len(self.classes), 3), dtype="uint8")
    
    def load_coco_classes(self):
        """Load COCO dataset class names"""
        try:
            with open('coco.names', 'r') as f:
                self.classes = [line.strip() for line in f.readlines()]
            logger.info(f"Loaded {len(self.classes)} COCO classes")
        except:
            # Default classes if file not found
            self.classes = [
                'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 
                'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 
                'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 
                'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 
                'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 
                'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 
                'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 
                'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 
                'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 
                'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 
                'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 
                'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 
                'scissors', 'teddy bear', 'hair drier', 'toothbrush'
            ]
            logger.info(f"Using default {len(self.classes)} classes")
    
    def load_model(self, model_name='yolov3'):
        """Load YOLO model"""
        try:
            model_paths = {
                'yolov3': {
                    'config': 'yolov3.cfg',
                    'weights': 'yolov3.weights'
                },
                'yolov3-tiny': {
                    'config': 'yolov3-tiny.cfg',
                    'weights': 'yolov3-tiny.weights'
                },
                'yolov4': {
                    'config': 'yolov4.cfg',
                    'weights': 'yolov4.weights'
                },
                'yolov4-tiny': {
                    'config': 'yolov4-tiny.cfg',
                    'weights': 'yolov4-tiny.weights'
                }
            }
            
            if model_name not in model_paths:
                logger.error(f"Model {model_name} not supported")
                return False
            
            config = model_paths[model_name]['config']
            weights = model_paths[model_name]['weights']
            
            # Try to load from local files
            self.net = cv2.dnn.readNet(weights, config)
            
            # Try to use GPU if available
            try:
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                logger.info(f"Using GPU acceleration for {model_name}")
            except:
                logger.info(f"Using CPU for {model_name}")
            
            self.current_model = model_name
            logger.info(f"Model {model_name} loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {e}")
            
            # Fallback to MobileNet SSD
            try:
                prototxt = 'MobileNetSSD_deploy.prototxt'
                model = 'MobileNetSSD_deploy.caffemodel'
                self.net = cv2.dnn.readNetFromCaffe(prototxt, model)
                self.current_model = 'ssd_mobilenet'
                logger.info("Loaded MobileNet SSD as fallback")
                return True
            except:
                logger.error("Could not load any detection model")
                return False
    
    def detect_objects(self, frame):
        """Detect objects in frame"""
        if self.net is None:
            return []
        
        height, width = frame.shape[:2]
        
        try:
            # Prepare blob for neural network
            blob = cv2.dnn.blobFromImage(
                frame, 1/255.0, (416, 416),
                swapRB=True, crop=False
            )
            
            self.net.setInput(blob)
            
            # Get output layer names
            layer_names = self.net.getLayerNames()
            output_layers = [layer_names[i[0] - 1] for i in self.net.getUnconnectedOutLayers()]
            
            # Forward pass
            outputs = self.net.forward(output_layers)
            
            # Process detections
            boxes = []
            confidences = []
            class_ids = []
            
            for output in outputs:
                for detection in output:
                    scores = detection[5:]
                    class_id = np.argmax(scores)
                    confidence = scores[class_id]
                    
                    if confidence > self.confidence_threshold:
                        # Object detected
                        center_x = int(detection[0] * width)
                        center_y = int(detection[1] * height)
                        w = int(detection[2] * width)
                        h = int(detection[3] * height)
                        
                        # Rectangle coordinates
                        x = int(center_x - w / 2)
                        y = int(center_y - h / 2)
                        
                        boxes.append([x, y, w, h])
                        confidences.append(float(confidence))
                        class_ids.append(class_id)
            
            # Apply Non-Maximum Suppression
            indexes = cv2.dnn.NMSBoxes(boxes, confidences, 
                                      self.confidence_threshold, 
                                      self.nms_threshold)
            
            # Prepare results
            results = []
            if len(indexes) > 0:
                for i in indexes.flatten():
                    x, y, w, h = boxes[i]
                    class_id = class_ids[i]
                    
                    result = {
                        'class': self.classes[class_id],
                        'confidence': float(confidences[i]),
                        'bbox': [int(x), int(y), int(w), int(h)],
                        'area': int(w * h),
                        'center': [int(x + w/2), int(y + h/2)],
                        'timestamp': datetime.now().isoformat()
                    }
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []
    
    def draw_detections(self, frame, detections):
        """Draw detection results on frame"""
        if not detections:
            return frame
        
        height, width = frame.shape[:2]
        
        for obj in detections:
            class_name = obj['class']
            confidence = obj['confidence']
            x, y, w, h = obj['bbox']
            
            # Get color for this class
            class_id = self.classes.index(class_name) if class_name in self.classes else 0
            color = [int(c) for c in self.colors[class_id]]
            
            # Draw bounding box
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            
            # Draw label background
            label = f"{class_name}: {confidence:.2f}"
            (label_width, label_height), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
            )
            
            cv2.rectangle(
                frame, 
                (x, y - label_height - baseline - 10),
                (x + label_width, y),
                color,
                -1
            )
            
            # Draw label text
            cv2.putText(
                frame, 
                label,
                (x, y - baseline - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1
            )
            
            # Draw center point
            center_x, center_y = obj['center']
            cv2.circle(frame, (center_x, center_y), 3, color, -1)
        
        # Draw detection info
        info_text = f"Objects: {len(detections)} | Model: {self.current_model}"
        cv2.putText(
            frame,
            info_text,
            (10, height - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            1
        )
        
        return frame
    
    def get_current_model(self):
        """Get current model name"""
        return self.current_model or 'No model loaded'