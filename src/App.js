import React, { useState, useRef, useEffect } from 'react';
import { Camera, Shield, AlertCircle, CheckCircle, Activity, Video, VideoOff, Loader } from 'lucide-react';

export default function AntiSpoofingDetection() {
  const [isActive, setIsActive] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState('idle');
  const [confidence, setConfidence] = useState(0);
  const [fps, setFps] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const imgRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000';

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/detection_status`);
        const data = await response.json();
        
        setDetectionStatus(data.status);
        setConfidence(data.confidence);
        setFps(data.fps);
      } catch (err) {
        console.error('Error fetching detection status:', err);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Start response:', data);
      
      if (data.status === 'started' || data.status === 'already_running') {
        setIsActive(true);
        
        // Small delay to ensure backend is ready
        setTimeout(() => {
          if (imgRef.current) {
            // Add timestamp to prevent caching
            const videoUrl = `${API_BASE_URL}/api/video_feed?t=${Date.now()}`;
            console.log('Setting video URL:', videoUrl);
            imgRef.current.src = videoUrl;
            
            // Add error handler for image loading
            imgRef.current.onerror = () => {
              console.error('Failed to load video feed');
              setError('Failed to load video feed. Check if camera is accessible.');
            };
            
            imgRef.current.onload = () => {
              console.log('Video feed loaded successfully');
            };
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error starting detection:', err);
      setError(`Failed to connect to backend: ${err.message}. Make sure Flask server is running on port 5000.`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Stop response:', data);
      
      if (data.status === 'stopped' || data.status === 'not_running') {
        setIsActive(false);
        setDetectionStatus('idle');
        setConfidence(0);
        setFps(0);
        if (imgRef.current) {
          imgRef.current.src = '';
          imgRef.current.onerror = null;
          imgRef.current.onload = null;
        }
      }
    } catch (err) {
      console.error('Error stopping detection:', err);
      setError(`Failed to stop detection: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (detectionStatus === 'real') return '#10b981';
    if (detectionStatus === 'fake') return '#ef4444';
    if (detectionStatus === 'scanning') return '#f59e0b';
    return '#8b5cf6';
  };

  const getStatusIcon = () => {
    if (detectionStatus === 'real') return <CheckCircle style={{width: 24, height: 24}} />;
    if (detectionStatus === 'fake') return <AlertCircle style={{width: 24, height: 24}} />;
    return <Shield style={{width: 24, height: 24}} />;
  };

  const getStatusText = () => {
    if (detectionStatus === 'real') return 'REAL FACE DETECTED';
    if (detectionStatus === 'fake') return 'SPOOF DETECTED';
    if (detectionStatus === 'scanning') return 'SCANNING...';
    return 'READY TO SCAN';
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
        
        @media (min-width: 768px) {
          .responsive-grid {
            grid-template-columns: 2fr 1fr !important;
          }
          .main-section {
            grid-column: auto !important;
          }
        }
      `}</style>
      
      <div style={styles.maxWidth}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Shield style={{width: 48, height: 48, color: '#c084fc'}} />
            <h1 style={styles.title}>FaceLock</h1>
          </div>
          <p style={styles.subtitle}>Advanced Anti-Spoofing Detection System</p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <div style={styles.errorContent}>
              <AlertCircle style={{width: 20, height: 20, color: '#fca5a5', flexShrink: 0}} />
              <div>
                <p style={styles.errorTitle}>Connection Error</p>
                <p style={styles.errorMessage}>{error}</p>
                <p style={styles.errorCode}>
                  Run: <code style={styles.code}>python app.py</code>
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={styles.grid} className="responsive-grid">
          <div style={styles.mainSection} className="main-section">
            <div style={styles.card}>
              <div style={styles.videoContainer}>
                {!isActive ? (
                  <div style={styles.inactiveScreen}>
                    <Camera style={{width: 80, height: 80, color: '#c084fc', marginBottom: 16}} />
                    <p style={styles.inactiveText}>Camera Feed Inactive</p>
                    <p style={styles.inactiveSubtext}>Click "Start Detection" to begin</p>
                  </div>
                ) : (
                  <>
                    <img 
                      ref={imgRef}
                      alt="Video Feed"
                      style={styles.videoFeed}
                    />
                    
                    {detectionStatus !== 'idle' && detectionStatus !== 'scanning' && (
                      <div style={{...styles.overlay, background: `linear-gradient(to right, ${getStatusColor()}, ${getStatusColor()}dd)`}}>
                        <div style={styles.overlayContent}>
                          <div style={styles.overlayLeft}>
                            {getStatusIcon()}
                            <div>
                              <p style={styles.overlayTitle}>{getStatusText()}</p>
                              <p style={styles.overlaySubtitle}>Confidence: {confidence}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detectionStatus === 'scanning' && (
                      <div style={{...styles.overlay, background: 'linear-gradient(to right, rgba(245, 158, 11, 0.8), rgba(249, 115, 22, 0.8))'}}>
                        <div style={styles.scanningContent}>
                          <Loader style={{width: 24, height: 24}} className="spin" />
                          <p style={styles.overlayTitle}>SCANNING FOR FACES...</p>
                        </div>
                      </div>
                    )}

                    <div style={styles.fpsCounter}>
                      <div style={styles.fpsContent}>
                        <Activity style={{width: 16, height: 16}} />
                        <span style={styles.fpsText}>{fps} FPS</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={styles.buttonContainer}>
                {!isActive ? (
                  <button
                    onClick={startCamera}
                    disabled={isLoading}
                    style={{...styles.button, ...styles.startButton, ...(isLoading ? styles.buttonDisabled : {})}}
                  >
                    {isLoading ? (
                      <>
                        <Loader style={{width: 24, height: 24}} className="spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Video style={{width: 24, height: 24}} />
                        Start Detection
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    disabled={isLoading}
                    style={{...styles.button, ...styles.stopButton, ...(isLoading ? styles.buttonDisabled : {})}}
                  >
                    {isLoading ? (
                      <>
                        <Loader style={{width: 24, height: 24}} className="spin" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <VideoOff style={{width: 24, height: 24}} />
                        Stop Detection
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={styles.sidePanel}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <Shield style={{width: 20, height: 20, color: '#c084fc'}} />
                Detection Status
              </h3>
              <div style={styles.statusGrid}>
                <div style={styles.statusItem}>
                  <p style={styles.statusLabel}>Current State</p>
                  <p style={{
                    ...styles.statusValue,
                    color: detectionStatus === 'real' ? '#4ade80' : 
                           detectionStatus === 'fake' ? '#f87171' : 
                           detectionStatus === 'scanning' ? '#fbbf24' : '#c084fc'
                  }}>
                    {detectionStatus === 'idle' ? 'Inactive' : detectionStatus.toUpperCase()}
                  </p>
                </div>
                <div style={styles.statusItem}>
                  <p style={styles.statusLabel}>Confidence Level</p>
                  <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                      <div 
                        style={{
                          ...styles.progressFill,
                          width: `${confidence}%`,
                          background: detectionStatus === 'real' ? '#10b981' : 
                                     detectionStatus === 'fake' ? '#ef4444' : '#8b5cf6'
                        }}
                      />
                    </div>
                    <span style={styles.progressText}>{confidence}%</span>
                  </div>
                </div>
                <div style={styles.statusItem}>
                  <p style={styles.statusLabel}>Frame Rate</p>
                  <p style={styles.statusValue}>{fps} FPS</p>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>System Info</h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Model:</span>
                  <span style={styles.infoValue}>YOLO v8</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Resolution:</span>
                  <span style={styles.infoValue}>640x480</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Confidence Threshold:</span>
                  <span style={styles.infoValue}>78%</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Classes:</span>
                  <span style={styles.infoValue}>Real / Fake</span>
                </div>
              </div>
            </div>

            <div style={styles.instructionsCard}>
              <h3 style={styles.instructionsTitle}>How to Use</h3>
              <ol style={styles.instructionsList}>
                <li style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>1.</span>
                  <span>Start the Flask backend server</span>
                </li>
                <li style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>2.</span>
                  <span>Click "Start Detection" to activate camera</span>
                </li>
                <li style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>3.</span>
                  <span>Position your face in the frame</span>
                </li>
                <li style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>4.</span>
                  <span>System will detect real vs spoofed faces</span>
                </li>
                <li style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>5.</span>
                  <span>Green = Real, Red = Fake/Spoof</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <p>Powered by YOLO Deep Learning Model • Real-time Face Anti-Spoofing</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)',
    padding: '24px',
  },
  maxWidth: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: 'white',
    margin: 0,
  },
  subtitle: {
    color: '#e9d5ff',
    fontSize: '18px',
    margin: 0,
  },
  errorBox: {
    marginBottom: '24px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    borderRadius: '12px',
    padding: '16px',
    backdropFilter: 'blur(12px)',
  },
  errorContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  errorTitle: {
    color: '#fecaca',
    fontWeight: '600',
    margin: 0,
  },
  errorMessage: {
    color: '#fca5a5',
    fontSize: '14px',
    marginTop: '4px',
  },
  errorCode: {
    color: '#fca5a5',
    fontSize: '12px',
    marginTop: '8px',
  },
  code: {
    background: 'rgba(127, 29, 29, 0.5)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  mainSection: {
    gridColumn: '1 / -1',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    background: 'rgba(30, 41, 59, 0.5)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  videoContainer: {
    position: 'relative',
    paddingBottom: '56.25%',
    background: '#0f172a',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid rgba(168, 85, 247, 0.3)',
  },
  inactiveScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveText: {
    color: '#e9d5ff',
    fontSize: '18px',
    margin: 0,
  },
  inactiveSubtext: {
    color: 'rgba(233, 213, 255, 0.6)',
    fontSize: '14px',
    marginTop: '8px',
  },
  videoFeed: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    right: '16px',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
  },
  overlayContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white',
  },
  overlayLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  overlayTitle: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: 0,
  },
  overlaySubtitle: {
    fontSize: '14px',
    opacity: 0.9,
    marginTop: '2px',
  },
  scanningContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'white',
  },
  fpsCounter: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(4px)',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  fpsContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#d8b4fe',
  },
  fpsText: {
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  buttonContainer: {
    marginTop: '24px',
    display: 'flex',
    justifyContent: 'center',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '18px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s',
    color: 'white',
  },
  startButton: {
    background: 'linear-gradient(to right, #9333ea, #6366f1)',
    boxShadow: '0 10px 15px -3px rgba(147, 51, 234, 0.5)',
  },
  stopButton: {
    background: 'linear-gradient(to right, #dc2626, #f43f5e)',
    boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statusItem: {
    background: 'rgba(15, 23, 42, 0.5)',
    borderRadius: '8px',
    padding: '16px',
  },
  statusLabel: {
    color: '#d8b4fe',
    fontSize: '14px',
    marginBottom: '4px',
  },
  statusValue: {
    fontWeight: 'bold',
    fontSize: '18px',
    color: 'white',
    margin: 0,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressBar: {
    flex: 1,
    background: '#334155',
    borderRadius: '9999px',
    height: '8px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s',
  },
  progressText: {
    color: 'white',
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  infoGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '14px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#e9d5ff',
  },
  infoLabel: {},
  infoValue: {
    fontWeight: '600',
  },
  instructionsCard: {
    background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.3), rgba(49, 46, 129, 0.3))',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(168, 85, 247, 0.2)',
  },
  instructionsTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '12px',
  },
  instructionsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  instructionItem: {
    display: 'flex',
    gap: '8px',
    color: '#e9d5ff',
    fontSize: '14px',
  },
  instructionNumber: {
    color: '#c084fc',
    fontWeight: 'bold',
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center',
    color: 'rgba(233, 213, 255, 0.6)',
    fontSize: '14px',
  },
};