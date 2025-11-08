from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import cvzone
import math
import time
import json
import base64
import numpy as np
import torch
import warnings

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Fix for PyTorch 2.6+ compatibility - Multiple approaches
try:
    # Method 1: Add safe globals
    torch.serialization.add_safe_globals([
        torch.nn.modules.container.Sequential,
        torch.nn.modules.conv.Conv2d,
        torch.nn.modules.batchnorm.BatchNorm2d,
        torch.nn.modules.activation.SiLU,
    ])
except Exception as e:
    print(f"Warning: Could not add safe globals: {e}")

# Suppress warnings
warnings.filterwarnings('ignore')

# Load model with error handling
print("Loading YOLO model...")
try:
    # Try loading normally first
    model = YOLO("models/best2.pt")
    print("✓ Model loaded successfully!")
except Exception as e:
    print(f"✗ Error loading model with default method: {e}")
    print("Attempting alternative loading method...")
    
    try:
        # Alternative: Set weights_only=False for trusted checkpoints
        import os
        os.environ['TORCH_LOAD_WEIGHTS_ONLY'] = 'False'
        model = YOLO("models/best2.pt")
        print("✓ Model loaded successfully with alternative method!")
    except Exception as e2:
        print(f"✗ Failed to load model: {e2}")
        print("\nPlease try one of these solutions:")
        print("1. Downgrade PyTorch: pip install torch==2.0.1")
        print("2. Re-export your model with: model.export(format='torchscript')")
        print("3. Use weights_only=False (only if you trust the model source)")
        exit(1)

classNames = ["fake", "real"]
confidence_threshold = 0.78
camera = None
is_running = False
latest_detection = {
    "status": "idle",
    "confidence": 0,
    "fps": 0,
    "class": "none"
}

prev_frame_time = 0

def get_camera():
    """Initialize camera if not already running"""
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        camera.set(3, 640)
        camera.set(4, 480)
    return camera

def release_camera():
    """Release camera resources"""
    global camera
    if camera is not None:
        camera.release()
        camera = None

def process_frame(frame):
    """Process frame with YOLO model and return annotated frame with detection info"""
    global prev_frame_time, latest_detection
    
    new_frame_time = time.time()
    
    # Run YOLO detection
    results = model(frame, stream=True, verbose=False)
    
    detection_found = False
    max_confidence = 0
    detected_class = "none"
    
    for r in results:
        boxes = r.boxes
        for box in boxes:
            # Bounding Box
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            w, h = x2 - x1, y2 - y1
            
            # Confidence
            conf = math.ceil((box.conf[0] * 100)) / 100
            
            # Class
            cls = int(box.cls[0])
            
            if conf > confidence_threshold:
                detection_found = True
                
                # Update max confidence detection
                if conf > max_confidence:
                    max_confidence = conf
                    detected_class = classNames[cls]
                
                # Draw bounding box
                if classNames[cls] == 'real':
                    color = (0, 255, 0)  # Green for real
                else:
                    color = (0, 0, 255)  # Red for fake
                
                cvzone.cornerRect(frame, (x1, y1, w, h), colorC=color, colorR=color)
                cvzone.putTextRect(frame, f'{classNames[cls].upper()} {int(conf * 100)}%',
                                 (max(0, x1), max(35, y1)), scale=2, thickness=4,
                                 colorR=color, colorB=color)
    
    # Calculate FPS
    fps = 1 / (new_frame_time - prev_frame_time) if prev_frame_time != 0 else 0
    prev_frame_time = new_frame_time
    
    # Update latest detection
    if detection_found:
        latest_detection = {
            "status": detected_class,
            "confidence": int(max_confidence * 100),
            "fps": int(fps),
            "class": detected_class
        }
    else:
        latest_detection = {
            "status": "scanning",
            "confidence": 0,
            "fps": int(fps),
            "class": "none"
        }
    
    return frame

def generate_frames():
    """Generator function to continuously capture and process frames"""
    global is_running
    
    cam = get_camera()
    
    while is_running:
        success, frame = cam.read()
        if not success:
            break
        
        # Process frame with detection
        processed_frame = process_frame(frame)
        
        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', processed_frame)
        frame_bytes = buffer.tobytes()
        
        # Yield frame in multipart format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/api/start', methods=['POST'])
def start_detection():
    """Start the detection system"""
    global is_running
    
    if not is_running:
        is_running = True
        get_camera()
        return jsonify({"status": "started", "message": "Detection started successfully"})
    return jsonify({"status": "already_running", "message": "Detection is already running"})

@app.route('/api/stop', methods=['POST'])
def stop_detection():
    """Stop the detection system"""
    global is_running, latest_detection
    
    if is_running:
        is_running = False
        release_camera()
        latest_detection = {
            "status": "idle",
            "confidence": 0,
            "fps": 0,
            "class": "none"
        }
        return jsonify({"status": "stopped", "message": "Detection stopped successfully"})
    return jsonify({"status": "not_running", "message": "Detection is not running"})

@app.route('/api/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/detection_status')
def detection_status():
    """Get current detection status"""
    return jsonify(latest_detection)

@app.route('/api/status')
def status():
    """Get system status"""
    return jsonify({
        "is_running": is_running,
        "model_loaded": model is not None,
        "camera_active": camera is not None and camera.isOpened(),
        "latest_detection": latest_detection
    })

@app.route('/api/config', methods=['GET', 'POST'])
def config():
    """Get or update configuration"""
    global confidence_threshold
    
    if request.method == 'POST':
        data = request.json
        if 'confidence_threshold' in data:
            confidence_threshold = float(data['confidence_threshold'])
        return jsonify({
            "status": "updated",
            "confidence_threshold": confidence_threshold
        })
    
    return jsonify({
        "confidence_threshold": confidence_threshold,
        "classes": classNames,
        "model": "YOLO (best2.pt)"
    })

@app.route('/')
def index():
    """Home route"""
    return jsonify({
        "message": "Anti-Spoofing Detection API",
        "endpoints": {
            "/api/start": "POST - Start detection",
            "/api/stop": "POST - Stop detection",
            "/api/video_feed": "GET - Video stream",
            "/api/detection_status": "GET - Current detection info",
            "/api/status": "GET - System status",
            "/api/config": "GET/POST - Configuration"
        }
    })

if __name__ == '__main__':
    try:
        print("=" * 50)
        print("Anti-Spoofing Detection API Server")
        print("=" * 50)
        print(f"Model: YOLO (best2.pt)")
        print(f"Classes: {classNames}")
        print(f"Confidence threshold: {confidence_threshold}")
        print("=" * 50)
        print("Starting server on http://localhost:5000")
        print("Press Ctrl+C to stop")
        print("=" * 50)
        app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
    except KeyboardInterrupt:
        print("\nShutting down...")
        release_camera()
        print("Server stopped")