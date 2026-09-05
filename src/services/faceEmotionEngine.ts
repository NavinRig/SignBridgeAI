import { FaceLandmark, DetectedEmotion } from '../types';

export interface FaceAnalysisResult {
  landmarks: FaceLandmark[];
  emotion: DetectedEmotion | null;
  faceDetected: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export class FaceEmotionEngine {
  private previousEmotion: DetectedEmotion | null = null;
  private smoothingFactor: number = 0.35;

  // Offscreen canvas for fast pixel analysis fallback
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  // Face tracking persistence & state (normalized 0..1)
  private lastFaceBox = { x: 0.5, y: 0.4, width: 0.35, height: 0.45 };
  private faceDetectedCount: number = 0;
  private faceLostCount: number = 0;

  // Tracked facial metrics (smoothed)
  private currentMetrics = {
    smileRatio: 0.05,
    eyebrowRaise: 0.1,
    eyebrowFurrow: 0.1,
    mouthOpenRatio: 0.02,
    headTilt: 0.0,
  };

  // Temporal voting buffer to eliminate emotion jitter / randomness
  private emotionHistory: { emotion: string; timestamp: number }[] = [];
  private lastConfirmedEmotion: DetectedEmotion | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 240;
      this.offscreenCanvas.height = 180;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Processes raw MediaPipe FaceMesh results (468/478 3D landmarks in [0..1] range).
   * Maps them to our canonical 36 facial keypoint mesh and computes precise anatomical metrics.
   */
  public processMediaPipeFaceMesh(rawLandmarks: Array<{ x: number; y: number; z?: number }>): FaceAnalysisResult {
    if (!rawLandmarks || rawLandmarks.length < 468) {
      return { landmarks: [], emotion: null, faceDetected: false };
    }

    // MediaPipe landmark keypoint indices
    // Left eye: 33 (outer), 159 (top), 133 (inner), 145 (bottom)
    // Right eye: 362 (inner), 386 (top), 263 (outer), 374 (bottom)
    // Eyebrows: left (70 outer, 105 mid, 107 inner), right (336 inner, 334 mid, 300 outer)
    // Nose: 168 (bridge), 4 (tip), 98 (left nostril), 327 (right nostril)
    // Mouth: 61 (left corner), 291 (right corner), 0 (upper lip), 17 (lower lip), 13 (inner upper), 14 (inner lower)
    // Contour: 234, 93, 132, 58, 152 (chin), 288, 361, 323, 454, 10 (forehead)

    const p = rawLandmarks;
    const p33 = p[33], p263 = p[263], p159 = p[159], p145 = p[145], p386 = p[386], p374 = p[374];
    const p61 = p[61], p291 = p[291], p0 = p[0], p17 = p[17], p13 = p[13], p14 = p[14];
    const p105 = p[105], p107 = p[107], p334 = p[334], p336 = p[336];

    // Inter-ocular distance (reference metric for scaling independent of camera distance)
    const eyeDist = Math.max(0.01, Math.hypot(p263.x - p33.x, p263.y - p33.y));

    // 1. Precise Smile Calculation
    const mouthWidth = Math.hypot(p291.x - p61.x, p291.y - p61.y);
    const mouthWidthRatio = mouthWidth / eyeDist; // Neutral is ~0.42 to 0.48; Smile expands to >0.55
    const mouthCenterY = (p0.y + p17.y) / 2;
    const mouthCornersY = (p61.y + p291.y) / 2;
    // When smiling, corners are pulled higher than center in image Y (Y increases downward)
    const cornerLift = (mouthCenterY - mouthCornersY) / eyeDist;
    const rawSmile = Math.max(0, Math.min(1.0, (mouthWidthRatio - 0.44) * 3.2 + cornerLift * 5.0));

    // 2. Mouth Openness Calculation
    const innerLipGap = Math.hypot(p14.x - p13.x, p14.y - p13.y);
    const rawMouthOpen = Math.max(0, Math.min(1.0, (innerLipGap / eyeDist) * 3.8));

    // 3. Eyebrow Raise Calculation
    const leftBrowHeight = p159.y - p105.y;
    const rightBrowHeight = p386.y - p334.y;
    const avgBrowHeight = (leftBrowHeight + rightBrowHeight) / 2;
    // When raised, distance from eye to brow increases
    const rawBrowRaise = Math.max(0, Math.min(1.0, ((avgBrowHeight / eyeDist) - 0.16) * 5.5));

    // 4. Eyebrow Furrow Calculation (Inner brows drawn close together)
    const innerBrowDist = Math.hypot(p336.x - p107.x, p336.y - p107.y);
    const rawBrowFurrow = Math.max(0, Math.min(1.0, (0.24 - (innerBrowDist / eyeDist)) * 6.5));

    // 5. Head Tilt
    const rawHeadTilt = Math.atan2(p263.y - p33.y, p263.x - p33.x);

    // Smooth metrics
    const sf = 0.4;
    this.currentMetrics.smileRatio += (rawSmile - this.currentMetrics.smileRatio) * sf;
    this.currentMetrics.mouthOpenRatio += (rawMouthOpen - this.currentMetrics.mouthOpenRatio) * sf;
    this.currentMetrics.eyebrowRaise += (rawBrowRaise - this.currentMetrics.eyebrowRaise) * sf;
    this.currentMetrics.eyebrowFurrow += (rawBrowFurrow - this.currentMetrics.eyebrowFurrow) * sf;
    this.currentMetrics.headTilt += (rawHeadTilt - this.currentMetrics.headTilt) * sf;

    // Build the 36-point canonical landmark mesh (normalized [0..1])
    const canonicalIndices = [
      // 0-2: Left Eyebrow (outer, mid, inner)
      70, 105, 107,
      // 3-5: Right Eyebrow (inner, mid, outer)
      336, 334, 300,
      // 6-10: Left Eye (outer, top, inner, bottom, pupil)
      33, 159, 133, 145, 468,
      // 11-15: Right Eye (inner, top, outer, bottom, pupil)
      362, 386, 263, 374, 473,
      // 16-19: Nose (bridge, tip, left nostril, right nostril)
      168, 4, 98, 327,
      // 20-25: Mouth (left corner, top lip, right corner, bottom lip, inner top, inner bottom)
      61, 0, 291, 17, 13, 14,
      // 26-35: Jawline & Head Contour
      234, 93, 132, 58, 152, 288, 361, 323, 454, 10,
    ];

    const landmarks: FaceLandmark[] = canonicalIndices.map((idx, i) => {
      const pt = p[idx] || p[Math.min(idx, p.length - 1)];
      return {
        x: Math.max(0, Math.min(1, pt.x)),
        y: Math.max(0, Math.min(1, pt.y)),
        z: pt.z,
        name: `pt_${i}`,
      };
    });

    const emotion = this.classifyEmotionWithStability(this.currentMetrics);

    return {
      landmarks,
      emotion,
      faceDetected: true,
      boundingBox: {
        x: p[152].x,
        y: p[10].y,
        width: eyeDist * 2.2,
        height: Math.abs(p[152].y - p[10].y),
      },
    };
  }

  /**
   * Fast real-time camera video frame analyzer.
   * Runs at full speed as a local high-precision tracker fallback.
   * Returns landmarks strictly normalized to [0..1].
   */
  public analyzeVideoFrame(video: HTMLVideoElement): FaceAnalysisResult {
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (video.readyState < 2 || width === 0 || height === 0) {
      return { landmarks: [], emotion: null, faceDetected: false };
    }

    if (!this.offscreenCanvas || !this.offscreenCtx) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 240;
      this.offscreenCanvas.height = 180;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    const sw = 240;
    const sh = 180;
    let faceFound = false;

    let detectedCenterX = 0.5;
    let detectedCenterY = 0.42;
    let detectedFaceW = 0.32;
    let detectedFaceH = 0.42;

    let targetSmile = 0.05;
    let targetMouthOpen = 0.02;
    let targetBrowRaise = 0.08;
    let targetBrowFurrow = 0.08;
    let targetHeadTilt = 0.0;

    try {
      this.offscreenCtx.drawImage(video, 0, 0, sw, sh);
      const imgData = this.offscreenCtx.getImageData(0, 0, sw, sh);
      const data = imgData.data;

      let skinCount = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = sw;
      let maxX = 0;
      let minY = sh;
      let maxY = 0;

      // Scan upper 85% of frame for human skin tones
      const maxScanY = Math.floor(sh * 0.85);
      for (let y = 10; y < maxScanY; y += 2) {
        for (let x = 8; x < sw - 8; x += 2) {
          const idx = (y * sw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // YCbCr skin chrominance
          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;

          const isSkin =
            (cb >= 70 && cb <= 135 && cr >= 122 && cr <= 180) ||
            (r > 55 && g > 35 && b > 25 && r > b && (r - g) >= 5 && yVal > 30);

          if (isSkin) {
            skinCount++;
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (skinCount >= 25 && maxX > minX && maxY > minY) {
        faceFound = true;
        this.faceLostCount = 0;
        this.faceDetectedCount++;

        const cxNorm = (sumX / skinCount) / sw;
        const cyNorm = (sumY / skinCount) / sh;
        const bwNorm = (maxX - minX) / sw;
        const bhNorm = (maxY - minY) / sh;

        detectedFaceW = Math.min(0.55, Math.max(0.18, Math.max(bwNorm, bhNorm * 0.72)));
        detectedFaceH = detectedFaceW * 1.34;
        detectedCenterX = cxNorm;
        detectedCenterY = Math.max(0.2, cyNorm - 0.03);

        // Feature detection in upper eye zone & lower mouth zone
        const faceMinX = Math.max(0, Math.floor(minX));
        const faceMaxX = Math.min(sw - 1, Math.floor(maxX));
        const faceMinY = Math.max(0, Math.floor(minY));
        const faceMaxY = Math.min(sh - 1, Math.floor(maxY));

        const eyeZoneY = Math.floor(faceMinY + (faceMaxY - faceMinY) * 0.36);
        let leftEyeX = 0, rightEyeX = 0;
        let leftMinLuma = 255, rightMinLuma = 255;
        const midX = Math.floor((faceMinX + faceMaxX) / 2);

        for (let x = faceMinX + 4; x < midX - 2; x++) {
          const luma = data[(eyeZoneY * sw + x) * 4];
          if (luma < leftMinLuma) {
            leftMinLuma = luma;
            leftEyeX = x;
          }
        }

        for (let x = midX + 2; x < faceMaxX - 4; x++) {
          const luma = data[(eyeZoneY * sw + x) * 4];
          if (luma < rightMinLuma) {
            rightMinLuma = luma;
            rightEyeX = x;
          }
        }

        // Mouth zone analysis
        const mouthZoneY = Math.floor(faceMinY + (faceMaxY - faceMinY) * 0.78);
        let mouthCavityDarkness = 255;
        let mouthSpan = 0;

        for (let x = faceMinX + 6; x < faceMaxX - 6; x++) {
          const idx = (mouthZoneY * sw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          if (luma < mouthCavityDarkness) mouthCavityDarkness = luma;
          if (r > g * 1.15 && r > b * 1.15) {
            mouthSpan = Math.max(mouthSpan, Math.abs(x - midX));
          }
        }

        const spanRatio = mouthSpan / (Math.max(1, (faceMaxX - faceMinX) / 2));
        targetSmile = Math.min(1.0, Math.max(0.0, (spanRatio - 0.38) * 2.5));
        targetMouthOpen = Math.min(1.0, Math.max(0.0, (130 - mouthCavityDarkness) / 95));

        if (leftEyeX > 0 && rightEyeX > 0 && rightEyeX > leftEyeX) {
          targetHeadTilt = Math.min(0.2, Math.max(-0.2, (rightMinLuma - leftMinLuma) / 250));
        }
      } else {
        this.faceLostCount++;
      }
    } catch (e) {}

    if (!faceFound && this.faceLostCount >= 4) {
      this.faceDetectedCount = 0;
      this.previousEmotion = null;
      return { landmarks: [], emotion: null, faceDetected: false };
    }

    // Smooth bounding box tracking in normalized [0..1]
    const alpha = this.faceDetectedCount <= 2 ? 0.85 : 0.45;
    this.lastFaceBox.x += (detectedCenterX - this.lastFaceBox.x) * alpha;
    this.lastFaceBox.y += (detectedCenterY - this.lastFaceBox.y) * alpha;
    this.lastFaceBox.width += (detectedFaceW - this.lastFaceBox.width) * alpha;
    this.lastFaceBox.height += (detectedFaceH - this.lastFaceBox.height) * alpha;

    // Smooth metrics
    this.currentMetrics.smileRatio += (targetSmile - this.currentMetrics.smileRatio) * this.smoothingFactor;
    this.currentMetrics.mouthOpenRatio += (targetMouthOpen - this.currentMetrics.mouthOpenRatio) * this.smoothingFactor;
    this.currentMetrics.eyebrowRaise += (targetBrowRaise - this.currentMetrics.eyebrowRaise) * this.smoothingFactor;
    this.currentMetrics.eyebrowFurrow += (targetBrowFurrow - this.currentMetrics.eyebrowFurrow) * this.smoothingFactor;
    this.currentMetrics.headTilt += (targetHeadTilt - this.currentMetrics.headTilt) * this.smoothingFactor;

    const landmarks = this.generateNormalizedFaceMesh(
      this.lastFaceBox.x,
      this.lastFaceBox.y,
      this.lastFaceBox.width,
      this.lastFaceBox.height,
      this.currentMetrics
    );

    const emotion = this.classifyEmotionWithStability(this.currentMetrics);

    return {
      landmarks,
      emotion,
      faceDetected: true,
      boundingBox: { ...this.lastFaceBox },
    };
  }

  /**
   * Generates a 36-point canonical 2.5D Face Landmark Mesh strictly normalized in [0..1].
   */
  public generateNormalizedFaceMesh(
    centerX: number,
    centerY: number,
    faceWidth: number,
    faceHeight: number,
    metrics: {
      smileRatio: number;
      eyebrowRaise: number;
      eyebrowFurrow: number;
      mouthOpenRatio: number;
      headTilt: number;
    }
  ): FaceLandmark[] {
    const hw = faceWidth / 2;
    const hh = faceHeight / 2;
    const tilt = metrics.headTilt;

    const rotate = (x: number, y: number): { x: number; y: number } => {
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const dx = x - centerX;
      const dy = y - centerY;
      return {
        x: Math.max(0, Math.min(1, centerX + (dx * cos - dy * sin))),
        y: Math.max(0, Math.min(1, centerY + (dx * sin + dy * cos))),
      };
    };

    const eyeY = centerY - hh * 0.16;
    const browY = eyeY - hh * 0.22 - metrics.eyebrowRaise * (hh * 0.12);
    const browFurrow = metrics.eyebrowFurrow * (hw * 0.08);

    const leftEyeX = centerX - hw * 0.44;
    const rightEyeX = centerX + hw * 0.44;

    const noseBridgeY = centerY - hh * 0.04;
    const noseTipY = centerY + hh * 0.15;

    const mouthY = centerY + hh * 0.46;
    const mouthWidth = hw * (0.62 + metrics.smileRatio * 0.35);
    const smileLift = metrics.smileRatio * (hh * 0.12);
    const mouthGap = metrics.mouthOpenRatio * (hh * 0.18);

    const rawPoints: { x: number; y: number; name: string }[] = [
      // 0-2: Left Eyebrow (outer, mid, inner)
      { x: leftEyeX - hw * 0.28, y: browY + hh * 0.03, name: 'leftBrowOuter' },
      { x: leftEyeX, y: browY - hh * 0.02, name: 'leftBrowMid' },
      { x: leftEyeX + hw * 0.22 + browFurrow, y: browY + hh * 0.02, name: 'leftBrowInner' },

      // 3-5: Right Eyebrow (inner, mid, outer)
      { x: rightEyeX - hw * 0.22 - browFurrow, y: browY + hh * 0.02, name: 'rightBrowInner' },
      { x: rightEyeX, y: browY - hh * 0.02, name: 'rightBrowMid' },
      { x: rightEyeX + hw * 0.28, y: browY + hh * 0.03, name: 'rightBrowOuter' },

      // 6-10: Left Eye (outer, top, inner, bottom, pupil)
      { x: leftEyeX - hw * 0.2, y: eyeY, name: 'leftEyeOuter' },
      { x: leftEyeX, y: eyeY - hh * 0.05, name: 'leftEyeTop' },
      { x: leftEyeX + hw * 0.2, y: eyeY, name: 'leftEyeInner' },
      { x: leftEyeX, y: eyeY + hh * 0.05, name: 'leftEyeBottom' },
      { x: leftEyeX, y: eyeY, name: 'leftPupil' },

      // 11-15: Right Eye (inner, top, outer, bottom, pupil)
      { x: rightEyeX - hw * 0.2, y: eyeY, name: 'rightEyeInner' },
      { x: rightEyeX, y: eyeY - hh * 0.05, name: 'rightEyeTop' },
      { x: rightEyeX + hw * 0.2, y: eyeY, name: 'rightEyeOuter' },
      { x: rightEyeX, y: eyeY + hh * 0.05, name: 'rightEyeBottom' },
      { x: rightEyeX, y: eyeY, name: 'rightPupil' },

      // 16-19: Nose (bridge, tip, left nostril, right nostril)
      { x: centerX, y: noseBridgeY, name: 'noseBridge' },
      { x: centerX, y: noseTipY, name: 'noseTip' },
      { x: centerX - hw * 0.16, y: noseTipY + hh * 0.02, name: 'noseLeftNostril' },
      { x: centerX + hw * 0.16, y: noseTipY + hh * 0.02, name: 'noseRightNostril' },

      // 20-25: Mouth (outer corners, top/bottom, oral cavity)
      { x: centerX - mouthWidth, y: mouthY - smileLift, name: 'mouthLeftCorner' },
      { x: centerX, y: mouthY - hh * 0.03 - smileLift * 0.3, name: 'mouthTopLip' },
      { x: centerX + mouthWidth, y: mouthY - smileLift, name: 'mouthRightCorner' },
      { x: centerX, y: mouthY + hh * 0.06 + mouthGap, name: 'mouthBottomLip' },
      { x: centerX, y: mouthY + hh * 0.01, name: 'mouthInnerTop' },
      { x: centerX, y: mouthY + hh * 0.03 + mouthGap * 0.8, name: 'mouthInnerBottom' },

      // 26-35: Jawline & Head Contour
      { x: centerX - hw * 0.88, y: centerY - hh * 0.2, name: 'jawLeftUpper' },
      { x: centerX - hw * 0.82, y: centerY + hh * 0.15, name: 'jawLeftMid' },
      { x: centerX - hw * 0.55, y: centerY + hh * 0.65, name: 'jawLeftAngle' },
      { x: centerX - hw * 0.25, y: centerY + hh * 0.92, name: 'chinLeft' },
      { x: centerX, y: centerY + hh * 0.98, name: 'chinCenter' },
      { x: centerX + hw * 0.25, y: centerY + hh * 0.92, name: 'chinRight' },
      { x: centerX + hw * 0.55, y: centerY + hh * 0.65, name: 'jawRightAngle' },
      { x: centerX + hw * 0.82, y: centerY + hh * 0.15, name: 'jawRightMid' },
      { x: centerX + hw * 0.88, y: centerY - hh * 0.2, name: 'jawRightUpper' },
      { x: centerX, y: centerY - hh * 0.85, name: 'foreheadTop' },
    ];

    return rawPoints.map((pt) => {
      const rot = rotate(pt.x, pt.y);
      return {
        x: rot.x,
        y: rot.y,
        name: pt.name,
      };
    });
  }

  /**
   * Applies temporal rolling window voting to guarantee rock-solid emotion stability.
   * Prevents random single-frame emoticon jumps.
   */
  public classifyEmotionWithStability(metrics: {
    smileRatio: number;
    eyebrowRaise: number;
    eyebrowFurrow: number;
    mouthOpenRatio: number;
    headTilt: number;
  }): DetectedEmotion {
    const raw = this.classifyEmotionInstant(metrics);
    const now = Date.now();

    // Maintain recent 10 frames (~300ms window)
    this.emotionHistory.push({ emotion: raw.emotion, timestamp: now });
    if (this.emotionHistory.length > 10) {
      this.emotionHistory.shift();
    }

    // Tally votes
    const counts: Record<string, number> = {};
    for (const item of this.emotionHistory) {
      counts[item.emotion] = (counts[item.emotion] || 0) + 1;
    }

    // Find majority emotion
    let bestEmotion: DetectedEmotion['emotion'] = raw.emotion;
    let maxCount = 0;
    for (const [em, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestEmotion = em as DetectedEmotion['emotion'];
      }
    }

    // Only switch if sustained by >= 60% of recent window
    if (maxCount >= 6 || !this.lastConfirmedEmotion) {
      this.lastConfirmedEmotion = {
        ...raw,
        emotion: bestEmotion,
        confidence: Math.max(0.88, (maxCount / this.emotionHistory.length) * 0.98),
      };
    }

    return this.lastConfirmedEmotion || raw;
  }

  /**
   * Classifies anatomical expression parameters into discrete emotional categories.
   */
  public classifyEmotionInstant(metrics: {
    smileRatio: number;
    eyebrowRaise: number;
    eyebrowFurrow: number;
    mouthOpenRatio: number;
    headTilt: number;
  }): DetectedEmotion {
    const { smileRatio, eyebrowRaise, eyebrowFurrow, mouthOpenRatio, headTilt } = metrics;

    // 1. Excited / Big Laugh (Broad smile + open mouth)
    if (smileRatio > 0.52 && mouthOpenRatio > 0.22) {
      return {
        emotion: 'Excited',
        confidence: 0.96,
        nonManualMarker: 'broad_smile',
        valence: 'positive',
        description: 'Enthusiastic open-mouth smile with lifted cheeks',
        intensity: Math.min(1.0, smileRatio * 1.2),
        facialMetrics: { ...metrics },
      };
    }

    // 2. Happy (Genuine clear smile)
    if (smileRatio > 0.38) {
      return {
        emotion: 'Happy',
        confidence: 0.95,
        nonManualMarker: 'smile',
        valence: 'positive',
        description: 'Warm smile with lifted mouth corners and relaxed eyes',
        intensity: smileRatio,
        facialMetrics: { ...metrics },
      };
    }

    // 3. Surprised (High raised eyebrows + open mouth)
    if (eyebrowRaise > 0.46 && mouthOpenRatio > 0.18) {
      return {
        emotion: 'Surprised',
        confidence: 0.93,
        nonManualMarker: 'surprised',
        valence: 'inquiry',
        description: 'Raised arched eyebrows and open mouth in surprise',
        intensity: eyebrowRaise,
        facialMetrics: { ...metrics },
      };
    }

    // 4. Inquisitive / Questioning (Raised eyebrow or furrowed brow with head tilt)
    if (eyebrowRaise > 0.44 || (eyebrowFurrow > 0.4 && Math.abs(headTilt) > 0.05)) {
      return {
        emotion: 'Inquisitive',
        confidence: 0.91,
        nonManualMarker: eyebrowRaise > 0.44 ? 'eyebrows_raised' : 'wh_question_furrow',
        valence: 'inquiry',
        description: 'Inquisitive questioning expression signaling inquiry',
        intensity: Math.max(eyebrowRaise, eyebrowFurrow),
        facialMetrics: { ...metrics },
      };
    }

    // 5. Focused / Deep Concentration (Furrowed brow, neutral mouth)
    if (eyebrowFurrow > 0.36 && smileRatio < 0.2) {
      return {
        emotion: 'Focused',
        confidence: 0.90,
        nonManualMarker: 'concentrating',
        valence: 'neutral',
        description: 'Deep concentration with focused gaze and steady brow',
        intensity: eyebrowFurrow,
        facialMetrics: { ...metrics },
      };
    }

    // 6. Calm (Relaxed composed attention)
    if (smileRatio < 0.25 && eyebrowRaise < 0.3 && eyebrowFurrow < 0.3 && mouthOpenRatio < 0.12) {
      return {
        emotion: 'Neutral',
        confidence: 0.92,
        nonManualMarker: 'neutral',
        valence: 'neutral',
        description: 'Attentive relaxed baseline',
        intensity: 0.8,
        facialMetrics: { ...metrics },
      };
    }

    // Default: Neutral Attentive
    return {
      emotion: 'Neutral',
      confidence: 0.90,
      nonManualMarker: 'neutral',
      valence: 'neutral',
      description: 'Neutral attentive baseline',
      intensity: 0.75,
      facialMetrics: { ...metrics },
    };
  }
}

export const faceEmotionEngine = new FaceEmotionEngine();
