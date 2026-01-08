#include <iostream>
#include <vector>
#include <string>
#include <chrono>
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>

using namespace std;
using namespace cv;
using namespace cv::dnn;
using namespace chrono;

class AIScanner {
private:
    Net net;
    vector<string> classes;
    float confidenceThreshold = 0.5;
    float nmsThreshold = 0.4;
    
public:
    // Constructor
    AIScanner() {
        // Load COCO class names
        loadClasses();
    }
    
    // Load YOLO model
    bool loadModel(const string& modelPath, const string& configPath) {
        try {
            net = readNet(modelPath, configPath);
            net.setPreferableBackend(DNN_BACKEND_OPENCV);
            net.setPreferableTarget(DNN_TARGET_CPU);
            
            cout << "Model loaded successfully: " << modelPath << endl;
            return true;
        } catch (const exception& e) {
            cerr << "Error loading model: " << e.what() << endl;
            return false;
        }
    }
    
    // Load class names
    void loadClasses() {
        // COCO dataset classes (80 classes)
        classes = {
            "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", 
            "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", 
            "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", 
            "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee", 
            "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", 
            "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", 
            "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", 
            "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", 
            "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", 
            "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", 
            "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", 
            "hair drier", "toothbrush"
        };
        cout << "Loaded " << classes.size() << " classes" << endl;
    }
    
    // Detect objects in frame
    vector<vector<float>> detectObjects(Mat& frame) {
        vector<vector<float>> detections;
        
        if (net.empty()) {
            cerr << "Network not loaded!" << endl;
            return detections;
        }
        
        auto start = high_resolution_clock::now();
        
        // Prepare blob
        Mat blob;
        blobFromImage(frame, blob, 1/255.0, Size(416, 416), Scalar(0,0,0), true, false);
        
        // Set input
        net.setInput(blob);
        
        // Forward pass
        vector<Mat> outputs;
        vector<string> outputNames = net.getUnconnectedOutLayersNames();
        net.forward(outputs, outputNames);
        
        // Process outputs
        vector<int> classIds;
        vector<float> confidences;
        vector<Rect> boxes;
        
        for (const auto& output : outputs) {
            float* data = (float*)output.data;
            
            for (int i = 0; i < output.rows; i++, data += output.cols) {
                Mat scores = output.row(i).colRange(5, output.cols);
                Point classIdPoint;
                double confidence;
                
                // Get the value and location of the maximum score
                minMaxLoc(scores, 0, &confidence, 0, &classIdPoint);
                
                if (confidence > confidenceThreshold) {
                    int centerX = (int)(data[0] * frame.cols);
                    int centerY = (int)(data[1] * frame.rows);
                    int width = (int)(data[2] * frame.cols);
                    int height = (int)(data[3] * frame.rows);
                    int left = centerX - width / 2;
                    int top = centerY - height / 2;
                    
                    classIds.push_back(classIdPoint.x);
                    confidences.push_back((float)confidence);
                    boxes.push_back(Rect(left, top, width, height));
                }
            }
        }
        
        // Apply Non-Maximum Suppression
        vector<int> indices;
        NMSBoxes(boxes, confidences, confidenceThreshold, nmsThreshold, indices);
        
        // Prepare results
        for (int idx : indices) {
            vector<float> detection = {
                (float)classIds[idx],          // class ID
                confidences[idx],              // confidence
                (float)boxes[idx].x,           // x
                (float)boxes[idx].y,           // y
                (float)boxes[idx].width,       // width
                (float)boxes[idx].height       // height
            };
            detections.push_back(detection);
        }
        
        auto end = high_resolution_clock::now();
        auto duration = duration_cast<milliseconds>(end - start);
        cout << "Detection time: " << duration.count() << "ms" << endl;
        
        return detections;
    }
    
    // Draw detections on frame
    void drawDetections(Mat& frame, const vector<vector<float>>& detections) {
        for (const auto& detection : detections) {
            int classId = (int)detection[0];
            float confidence = detection[1];
            int x = (int)detection[2];
            int y = (int)detection[3];
            int width = (int)detection[4];
            int height = (int)detection[5];
            
            // Draw bounding box
            rectangle(frame, Point(x, y), Point(x + width, y + height), Scalar(0, 255, 0), 2);
            
            // Draw label
            string label = format("%s: %.2f", classes[classId].c_str(), confidence);
            int baseline;
            Size labelSize = getTextSize(label, FONT_HERSHEY_SIMPLEX, 0.5, 1, &baseline);
            
            rectangle(frame, Point(x, y - labelSize.height - 10), 
                     Point(x + labelSize.width, y), Scalar(0, 255, 0), FILLED);
            
            putText(frame, label, Point(x, y - 5), 
                   FONT_HERSHEY_SIMPLEX, 0.5, Scalar(0, 0, 0), 1);
        }
    }
    
    // Set confidence threshold
    void setConfidenceThreshold(float threshold) {
        confidenceThreshold = threshold;
    }
    
    // Get class name by ID
    string getClassName(int classId) {
        if (classId >= 0 && classId < classes.size()) {
            return classes[classId];
        }
        return "Unknown";
    }
};

int main() {
    cout << "=== AI OBJECT SCANNER (C++) ===" << endl;
    
    // Initialize scanner
    AIScanner scanner;
    
    // Load model (update paths as needed)
    string modelPath = "yolov3.weights";
    string configPath = "yolov3.cfg";
    
    if (!scanner.loadModel(modelPath, configPath)) {
        cerr << "Failed to load model. Exiting." << endl;
        return 1;
    }
    
    // Open camera
    VideoCapture cap(0);
    if (!cap.isOpened()) {
        cerr << "Cannot open camera!" << endl;
        return 1;
    }
    
    cout << "Camera opened successfully" << endl;
    cout << "Press ESC to exit" << endl;
    
    // Main loop
    Mat frame;
    int frameCount = 0;
    auto startTime = high_resolution_clock::now();
    
    while (true) {
        cap >> frame;
        if (frame.empty()) break;
        
        frameCount++;
        
        // Detect objects
        auto detections = scanner.detectObjects(frame);
        
        // Draw detections
        scanner.drawDetections(frame, detections);
        
        // Calculate and display FPS
        auto currentTime = high_resolution_clock::now();
        auto elapsed = duration_cast<seconds>(currentTime - startTime).count();
        float fps = frameCount / max(1.0f, (float)elapsed);
        
        string fpsText = format("FPS: %.1f | Objects: %d", fps, detections.size());
        putText(frame, fpsText, Point(10, 30), 
               FONT_HERSHEY_SIMPLEX, 0.7, Scalar(0, 255, 0), 2);
        
        // Display frame
        imshow("AI Object Scanner", frame);
        
        // Exit on ESC
        if (waitKey(1) == 27) break;
    }
    
    cap.release();
    destroyAllWindows();
    
    cout << "Application terminated" << endl;
    return 0;
}