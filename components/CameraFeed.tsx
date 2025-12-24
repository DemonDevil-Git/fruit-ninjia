import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandPosition } from '../types';

interface CameraFeedProps {
  onHandUpdate: (pos: HandPosition) => void;
  onLoaded: () => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onHandUpdate, onLoaded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!isMounted) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (!isMounted) return;
        landmarkerRef.current = landmarker;
        startCamera();
      } catch (err: any) {
        setError("Failed to load hand tracking: " + err.message);
      }
    };

    setupMediaPipe();

    return () => {
      isMounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          onLoaded();
          predictWebcam();
        };
      }
    } catch (err) {
      setError("Camera permission denied or not available.");
    }
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker) return;

    // Detect logic
    if (video.currentTime > 0 && !video.paused && !video.ended) {
      const results = landmarker.detectForVideo(video, performance.now());
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Draw skeleton
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 2
          });
          drawingUtils.drawLandmarks(landmarks, {
            color: "#FF0000",
            lineWidth: 1,
            radius: 3
          });

          // Extract Index Finger Tip (Index 8)
          // X is mirrored in selfie mode, so 1 - x
          const indexTip = landmarks[8];
          onHandUpdate({
            x: 1 - indexTip.x, 
            y: indexTip.y,
            isDetected: true
          });
        } else {
           onHandUpdate({ x: 0, y: 0, isDetected: false });
        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="absolute bottom-4 right-4 w-48 h-36 border-2 border-cyan-500/50 rounded-lg overflow-hidden bg-black/50 z-50 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
      {error && <div className="text-red-500 text-xs p-2">{error}</div>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 opacity-60"
      />
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
      />
    </div>
  );
};

export default CameraFeed;
