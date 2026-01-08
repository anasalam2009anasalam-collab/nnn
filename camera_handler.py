import cv2
import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

class CameraHandler:
    def __init__(self):
        self.cap = None
        self.camera_index = 0
        self.frame_width = 640
        self.frame_height = 480
        self.fps = 0
        self.last_fps_update = time.time()
        self.frame_count = 0
        self.connected = False
    
    def initialize(self, camera_index=0):
        """Initialize camera"""
        try:
            self.cap = cv2.VideoCapture(camera_index)
            
            # Set camera properties
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            
            # Test camera
            ret, frame = self.cap.read()
            if ret:
                self.connected = True
                logger.info(f"Camera initialized: {self.frame_width}x{self.frame_height}")
                return True
            else:
                self.cap.release()
                self.cap = None
                logger.error("Camera test failed")
                return False
                
        except Exception as e:
            logger.error(f"Camera initialization error: {e}")
            return False
    
    def get_frame(self):
        """Get frame from camera"""
        if not self.connected or self.cap is None:
            return self.get_fallback_frame()
        
        try:
            ret, frame = self.cap.read()
            
            if not ret:
                logger.warning("Camera read failed")
                self.connected = False
                return self.get_fallback_frame()
            
            # Update FPS calculation
            self.frame_count += 1
            current_time = time.time()
            
            if current_time - self.last_fps_update >= 1:
                self.fps = self.frame_count
                self.frame_count = 0
                self.last_fps_update = current_time
            
            # Convert BGR to RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return frame
            
        except Exception as e:
            logger.error(f"Frame capture error: {e}")
            self.connected = False
            return self.get_fallback_frame()
    
    def get_fallback_frame(self):
        """Generate fallback frame when camera is not available"""
        frame = np.zeros((self.frame_height, self.frame_width, 3), dtype=np.uint8)
        
        # Add some visual elements
        cv2.putText(frame, "CAMERA NOT AVAILABLE", (100, 200),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, "Using simulated feed", (120, 240),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 0), 1)
        
        # Add moving object simulation
        t = time.time()
        x = int(self.frame_width / 2 + np.sin(t) * 100)
        y = int(self.frame_height / 2 + np.cos(t * 0.7) * 80)
        
        cv2.circle(frame, (x, y), 30, (0, 255, 0), -1)
        cv2.putText(frame, "SIM OBJECT", (x-40, y-40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
        return frame
    
    def get_fps(self):
        """Get current FPS"""
        return self.fps
    
    def get_resolution(self):
        """Get camera resolution"""
        return f"{self.frame_width}x{self.frame_height}"
    
    def is_connected(self):
        """Check if camera is connected"""
        return self.connected
    
    def release(self):
        """Release camera resources"""
        if self.cap is not None:
            self.cap.release()
            self.connected = False
            logger.info("Camera released")
    
    def __del__(self):
        """Destructor"""
        self.release()