import { DetectedGesture, FingerStates, HandLandmark, HandPoseData } from '../types';

// Distance helper
function distance(p1: HandLandmark, p2: HandLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 2D distance helper
function distance2D(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class GestureClassifier {
  private history: { name: string; score: number; timestamp: number }[] = [];
  private readonly historyWindowMs = 450;
  private readonly minConfidence = 0.65;

  /**
   * Analyze 21 landmarks of a single hand and classify the ASL sign/letter/phrase.
   */
  public classifyHand(landmarks: HandLandmark[], handedness: 'Left' | 'Right' = 'Right'): DetectedGesture {
    if (!landmarks || landmarks.length < 21) {
      return {
        name: 'NO_HAND',
        category: 'phrase',
        confidence: 0,
        timestamp: Date.now(),
        isStable: false,
      };
    }

    const wrist = landmarks[0];
    const thumbCmc = landmarks[1];
    const thumbMcp = landmarks[2];
    const thumbIp = landmarks[3];
    const thumbTip = landmarks[4];

    const indexMcp = landmarks[5];
    const indexPip = landmarks[6];
    const indexDip = landmarks[7];
    const indexTip = landmarks[8];

    const middleMcp = landmarks[9];
    const middlePip = landmarks[10];
    const middleDip = landmarks[11];
    const middleTip = landmarks[12];

    const ringMcp = landmarks[13];
    const ringPip = landmarks[14];
    const ringDip = landmarks[15];
    const ringTip = landmarks[16];

    const pinkyMcp = landmarks[17];
    const pinkyPip = landmarks[18];
    const pinkyDip = landmarks[19];
    const pinkyTip = landmarks[20];

    // Reference hand scale: distance from wrist to middle MCP
    const handScale = distance(wrist, middleMcp) || 0.1;

    // Helper: Is finger extended? (Tip is further from wrist than PIP/MCP)
    const isIndexExtended = distance(wrist, indexTip) > distance(wrist, indexPip) * 1.15 && indexTip.y < indexPip.y + 0.05;
    const isMiddleExtended = distance(wrist, middleTip) > distance(wrist, middlePip) * 1.15 && middleTip.y < middlePip.y + 0.05;
    const isRingExtended = distance(wrist, ringTip) > distance(wrist, ringPip) * 1.15 && ringTip.y < ringPip.y + 0.05;
    const isPinkyExtended = distance(wrist, pinkyTip) > distance(wrist, pinkyPip) * 1.15 && pinkyTip.y < pinkyPip.y + 0.05;

    // Thumb extension: distance of thumbTip from pinkyMcp / indexMcp
    const thumbSpread = distance(thumbTip, indexMcp) / handScale;
    const isThumbExtended = thumbSpread > 0.85 && distance(wrist, thumbTip) > distance(wrist, thumbMcp) * 1.1;

    // Pinch distance: thumb tip to other finger tips
    const thumbIndexDist = distance(thumbTip, indexTip) / handScale;
    const thumbMiddleDist = distance(thumbTip, middleTip) / handScale;
    const indexMiddleDist = distance(indexTip, middleTip) / handScale;
    const ringPinkyDist = distance(ringTip, pinkyTip) / handScale;

    const fingerStates: FingerStates = {
      thumb: isThumbExtended ? 'extended' : thumbIndexDist < 0.35 ? 'touching' : 'folded',
      index: isIndexExtended ? 'extended' : thumbIndexDist < 0.35 ? 'touching' : 'folded',
      middle: isMiddleExtended ? 'extended' : thumbMiddleDist < 0.35 ? 'touching' : 'folded',
      ring: isRingExtended ? 'extended' : 'folded',
      pinky: isPinkyExtended ? 'extended' : 'folded',
    };

    let signName = 'UNKNOWN';
    let category: DetectedGesture['category'] = 'word';
    let confidence = 0.7;
    let description = '';

    // 1. I LOVE YOU (ILY): Thumb, Index, Pinky extended; Middle, Ring folded
    if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
      signName = 'I LOVE YOU';
      category = 'phrase';
      confidence = 0.95;
      description = 'Thumb, Index & Pinky extended (ASL I-L-Y sign)';
    }
    // 2. PEACE / VICTORY / NUMBER 2: Index + Middle extended, Ring + Pinky folded, Thumb folded
    else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbExtended && indexMiddleDist > 0.35) {
      signName = 'PEACE / 2';
      category = 'word';
      confidence = 0.94;
      description = 'Index & Middle fingers spread in V shape';
    }
    // 3. LETTER U: Index + Middle extended together (touching)
    else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbExtended && indexMiddleDist <= 0.35) {
      signName = 'LETTER U';
      category = 'alphabet';
      confidence = 0.91;
      description = 'Index & Middle fingers held together upright';
    }
    // 4. LETTER L: Index extended up, Thumb extended out 90 deg, others folded
    else if (isIndexExtended && isThumbExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      signName = 'LETTER L';
      category = 'alphabet';
      confidence = 0.96;
      description = 'Index and Thumb form an L shape';
    }
    // 5. LETTER Y / SHAKA: Thumb + Pinky extended, Index + Middle + Ring folded
    else if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
      signName = 'LETTER Y / SHAKA';
      category = 'alphabet';
      confidence = 0.95;
      description = 'Thumb and Pinky extended outward';
    }
    // 6. THUMBS UP / APPROVE: Thumb extended up, all 4 fingers folded into fist
    else if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended && thumbTip.y < wrist.y - 0.1) {
      signName = 'THUMBS UP / APPROVE';
      category = 'phrase';
      confidence = 0.96;
      description = 'Fist with thumb pointing upward';
    }
    // 7. OKAY / LETTER F: Thumb + Index touching in circle, Middle + Ring + Pinky upright
    else if (thumbIndexDist < 0.4 && isMiddleExtended && isRingExtended && isPinkyExtended) {
      signName = 'OKAY / LETTER F';
      category = 'phrase';
      confidence = 0.95;
      description = 'Thumb & Index pinched, other 3 fingers upright';
    }
    // 8. LETTER W / NUMBER 3: Index + Middle + Ring upright, Pinky + Thumb folded
    else if (isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) {
      signName = 'LETTER W / 3';
      category = 'alphabet';
      confidence = 0.92;
      description = 'Index, Middle, and Ring fingers upright';
    }
    // 9. LETTER B / FLAT OPEN PALM (HELLO / STOP): All 4 upright together
    else if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      if (isThumbExtended) {
        signName = 'HELLO / OPEN HAND';
        category = 'phrase';
        confidence = 0.93;
        description = 'All 5 fingers open and extended';
      } else {
        signName = 'LETTER B';
        category = 'alphabet';
        confidence = 0.91;
        description = 'Four fingers upright together, thumb tucked across';
      }
    }
    // 10. LETTER D / NUMBER 1 / POINT: Only Index pointing up
    else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbExtended) {
      signName = 'LETTER D / 1';
      category = 'alphabet';
      confidence = 0.92;
      description = 'Single index finger pointing upward';
    }
    // 11. LETTER I: Only Pinky upright, others folded
    else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended && !isThumbExtended) {
      signName = 'LETTER I';
      category = 'alphabet';
      confidence = 0.93;
      description = 'Only Pinky finger upright';
    }
    // 12. NO / PINCH SNAP: Index + Middle touching Thumb, Ring + Pinky folded
    else if (thumbIndexDist < 0.45 && thumbMiddleDist < 0.45 && !isRingExtended && !isPinkyExtended) {
      signName = 'NO / DECLINE';
      category = 'phrase';
      confidence = 0.89;
      description = 'Index & Middle tips touching thumb in snap position';
    }
    // 13. S-FIST / YES: All fingers tightly folded
    else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbExtended) {
      signName = 'YES / FIST';
      category = 'phrase';
      confidence = 0.88;
      description = 'Closed fist / ASL Yes nod';
    }
    // 14. LETTER C: Curved arc
    else if (
      !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended &&
      thumbIndexDist > 0.4 && thumbIndexDist < 0.9 &&
      distance(wrist, indexTip) > distance(wrist, indexMcp) * 0.9
    ) {
      signName = 'LETTER C';
      category = 'alphabet';
      confidence = 0.84;
      description = 'Fingers curved in C profile';
    }

    // Temporal smoothing
    const now = Date.now();
    this.history.push({ name: signName, score: confidence, timestamp: now });
    this.history = this.history.filter((item) => now - item.timestamp < this.historyWindowMs);

    // Find dominant gesture in window
    const counts: Record<string, number> = {};
    for (const item of this.history) {
      counts[item.name] = (counts[item.name] || 0) + 1;
    }

    let dominantSign = signName;
    let maxCount = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > maxCount) {
        maxCount = v;
        dominantSign = k;
      }
    }

    const isStable = this.history.length >= 4 && maxCount / this.history.length >= 0.75 && dominantSign !== 'UNKNOWN';

    return {
      name: dominantSign,
      category,
      confidence,
      timestamp: now,
      isStable,
      fingerStates,
      description,
      handedness,
    };
  }
}

export const gestureClassifier = new GestureClassifier();
