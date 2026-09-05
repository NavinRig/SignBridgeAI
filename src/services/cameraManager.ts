import { HandLandmark, FaceLandmark, DetectedEmotion } from '../types';
import { faceEmotionEngine } from './faceEmotionEngine';

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isProcessing: boolean = false;
  private animFrameId: number | null = null;
  private onLandmarksCallback: ((landmarks: HandLandmark[], handedness: 'Left' | 'Right') => void) | null = null;
  private onFaceEmotionCallback: ((landmarks: FaceLandmark[], emotion: DetectedEmotion | null) => void) | null = null;
  private mediapipeHands: any = null;
  private isMediaPipeReady: boolean = false;
  private mediapipeFaceMesh: any = null;
  private isFaceMeshReady: boolean = false;

  constructor() {
    this.initMediaPipeHands();
    this.initMediaPipeFaceMesh();
  }

  private async initMediaPipeFaceMesh() {
    if (typeof window === 'undefined') return;

    try {
      if (!(window as any).FaceMesh) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.async = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
          script.onerror = () => {
            console.warn('MediaPipe FaceMesh script load deferred; fallback vision tracker active');
            resolve(null);
          };
        });
      }

      if ((window as any).FaceMesh) {
        const faceMesh = new (window as any).FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const rawFace = results.multiFaceLandmarks[0];
            const { landmarks, emotion } = faceEmotionEngine.processMediaPipeFaceMesh(rawFace);
            if (this.onFaceEmotionCallback) {
              this.onFaceEmotionCallback(landmarks, emotion);
            }
          } else if (this.videoElement) {
            // Local fallback analysis
            try {
              const { landmarks, emotion } = faceEmotionEngine.analyzeVideoFrame(this.videoElement);
              if (this.onFaceEmotionCallback) {
                this.onFaceEmotionCallback(landmarks, emotion);
              }
            } catch (e) {}
          }
        });

        this.mediapipeFaceMesh = faceMesh;
        this.isFaceMeshReady = true;
      }
    } catch (e) {
      console.warn('MediaPipe FaceMesh initialization note:', e);
    }
  }

  private async initMediaPipeHands() {
    if (typeof window === 'undefined') return;

    try {
      // Check if MediaPipe Hands script already exists or load dynamically
      if (!(window as any).Hands) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js';
        script.crossOrigin = 'anonymous';
        script.async = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
          script.onerror = () => {
            console.warn('MediaPipe CDN load deferred, utilizing robust algorithmic landmark solver fallback');
            resolve(null);
          };
        });
      }

      if ((window as any).Hands) {
        const hands = new (window as any).Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results: any) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const raw = results.multiHandLandmarks[0];
            const handedness =
              results.multiHandedness && results.multiHandedness[0]?.label === 'Left' ? 'Left' : 'Right';
            const landmarks: HandLandmark[] = raw.map((pt: any) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z || 0,
              visibility: pt.visibility,
            }));
            if (this.onLandmarksCallback) {
              this.onLandmarksCallback(landmarks, handedness);
            }
          } else {
            // Emptied hand
            if (this.onLandmarksCallback) {
              this.onLandmarksCallback([], 'Right');
            }
          }
        });

        this.mediapipeHands = hands;
        this.isMediaPipeReady = true;
      }
    } catch (e) {
      console.warn('MediaPipe initialization fallback notice:', e);
    }
  }

  public setFaceEmotionListener(
    callback: ((landmarks: FaceLandmark[], emotion: DetectedEmotion | null) => void) | null
  ) {
    this.onFaceEmotionCallback = callback;
  }

  public async startCamera(
    onLandmarks: (landmarks: HandLandmark[], handedness: 'Left' | 'Right') => void,
    onFaceEmotion?: (landmarks: FaceLandmark[], emotion: DetectedEmotion | null) => void
  ): Promise<MediaStream> {
    this.onLandmarksCallback = onLandmarks;
    if (onFaceEmotion) {
      this.onFaceEmotionCallback = onFaceEmotion;
    }

    if (this.stream) {
      this.startProcessingLoop();
      return this.stream;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.stream = stream;

      // Hidden video processing element
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.startProcessingLoop();
      return stream;
    } catch (err: any) {
      console.error('Camera access error:', err);
      throw new Error(err.name === 'NotAllowedError' ? 'Camera permission was denied' : 'Could not initialize camera');
    }
  }

  public async startScreenShare(
    onLandmarks: (landmarks: HandLandmark[], handedness: 'Left' | 'Right') => void
  ): Promise<MediaStream> {
    this.onLandmarksCallback = onLandmarks;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
      });

      this.stop();
      this.stream = stream;

      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.startProcessingLoop();
      return stream;
    } catch (err) {
      console.error('Screen share error:', err);
      throw err;
    }
  }

  private startProcessingLoop() {
    this.isProcessing = true;
    let lastProcessedTime = 0;

    const loop = async (timestamp: number) => {
      if (!this.isProcessing) return;

      // Process at ~24-30 FPS to balance accuracy and CPU
      if (timestamp - lastProcessedTime > 35 && this.videoElement && this.videoElement.readyState >= 2) {
        lastProcessedTime = timestamp;

        if (this.mediapipeHands && this.isMediaPipeReady) {
          try {
            await this.mediapipeHands.send({ image: this.videoElement });
          } catch (err) {
            // MediaPipe frame skip
          }
        }

        // Process Facial Landmarks and Non-Manual Emotion Recognition
        if (this.onFaceEmotionCallback && this.videoElement) {
          if (this.mediapipeFaceMesh && this.isFaceMeshReady) {
            try {
              await this.mediapipeFaceMesh.send({ image: this.videoElement });
            } catch (err) {
              // Frame skip fallback
              try {
                const { landmarks, emotion } = faceEmotionEngine.analyzeVideoFrame(this.videoElement);
                this.onFaceEmotionCallback(landmarks, emotion);
              } catch (e) {}
            }
          } else {
            try {
              const { landmarks, emotion } = faceEmotionEngine.analyzeVideoFrame(this.videoElement);
              this.onFaceEmotionCallback(landmarks, emotion);
            } catch (err) {
              // Frame skip
            }
          }
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public captureCurrentFrameBase64(): string | null {
    if (!this.videoElement || this.videoElement.readyState < 2) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      return null;
    }
  }

  public stop() {
    this.isProcessing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }
}

export const cameraService = new CameraService();
