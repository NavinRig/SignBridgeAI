import { HandLandmark } from '../types';

export interface FingerAccuracy {
  name: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
  score: number; // 0 - 100
  status: 'perfect' | 'good' | 'adjust';
  tip?: string;
}

export interface LandmarkMatchResult {
  signId: string;
  signName: string;
  overallScore: number; // 0 - 100
  isMatched: boolean;
  fingerAccuracies: Record<'thumb' | 'index' | 'middle' | 'ring' | 'pinky', FingerAccuracy>;
  palmOrientationScore: number;
  detectedHandedness: 'Left' | 'Right';
  targetHandedness: 'Left' | 'Right';
  correctiveFeedback: string[];
  normalizedUserLandmarks: { x: number; y: number; z: number }[];
  normalizedRefLandmarks: { x: number; y: number; z: number }[];
  keypointErrors: number[]; // Euclidean distance error for each of 21 landmarks
}

// MediaPipe Hand Landmark Index reference:
// 0: WRIST
// 1: THUMB_CMC, 2: THUMB_MCP, 3: THUMB_IP, 4: THUMB_TIP
// 5: INDEX_MCP, 6: INDEX_PIP, 7: INDEX_DIP, 8: INDEX_TIP
// 9: MIDDLE_MCP, 10: MIDDLE_PIP, 11: MIDDLE_DIP, 12: MIDDLE_TIP
// 13: RING_MCP, 14: RING_PIP, 15: RING_DIP, 16: RING_TIP
// 17: PINKY_MCP, 18: PINKY_PIP, 19: PINKY_DIP, 20: PINKY_TIP

export interface ReferencePose {
  id: string;
  name: string;
  landmarks: { x: number; y: number; z: number }[];
  description: string;
  fingerRequirements: {
    thumb: 'extended' | 'folded' | 'touching' | 'curled';
    index: 'extended' | 'folded' | 'touching' | 'curled';
    middle: 'extended' | 'folded' | 'touching' | 'curled';
    ring: 'extended' | 'folded' | 'touching' | 'curled';
    pinky: 'extended' | 'folded' | 'touching' | 'curled';
  };
  tips: string[];
}

/**
 * Generates canonical normalized 21-landmark poses for reference ASL signs.
 * Coordinates are normalized: Wrist at (0.5, 0.85, 0), middle MCP at (0.5, 0.55, 0).
 */
function createCanonicalPose(
  id: string,
  name: string,
  description: string,
  reqs: ReferencePose['fingerRequirements'],
  tips: string[],
  overrides?: Partial<Record<number, { x: number; y: number; z: number }>>
): ReferencePose {
  // Base wrist & MCP centers for neutral palm
  const wrist = { x: 0.5, y: 0.85, z: 0 };
  const thumbCmc = { x: 0.44, y: 0.78, z: -0.02 };
  const thumbMcp = { x: 0.4, y: 0.7, z: -0.04 };
  const indexMcp = { x: 0.45, y: 0.58, z: -0.01 };
  const middleMcp = { x: 0.5, y: 0.55, z: 0 };
  const ringMcp = { x: 0.55, y: 0.58, z: 0.01 };
  const pinkyMcp = { x: 0.6, y: 0.62, z: 0.02 };

  // Generate fingers based on requirement
  const getFingerPoints = (
    mcp: { x: number; y: number; z: number },
    state: 'extended' | 'folded' | 'touching' | 'curled',
    dirX: number,
    dirY: number
  ) => {
    if (state === 'extended') {
      const pip = { x: mcp.x + dirX * 0.35, y: mcp.y + dirY * 0.35, z: mcp.z - 0.02 };
      const dip = { x: mcp.x + dirX * 0.7, y: mcp.y + dirY * 0.7, z: mcp.z - 0.03 };
      const tip = { x: mcp.x + dirX * 1.05, y: mcp.y + dirY * 1.05, z: mcp.z - 0.04 };
      return [pip, dip, tip];
    } else if (state === 'folded') {
      const pip = { x: mcp.x + dirX * 0.2, y: mcp.y + dirY * 0.15, z: mcp.z + 0.04 };
      const dip = { x: mcp.x + dirX * 0.15, y: mcp.y + 0.08, z: mcp.z + 0.06 };
      const tip = { x: mcp.x + dirX * 0.08, y: mcp.y + 0.18, z: mcp.z + 0.04 };
      return [pip, dip, tip];
    } else if (state === 'curled') {
      const pip = { x: mcp.x + dirX * 0.25, y: mcp.y + dirY * 0.2, z: mcp.z - 0.04 };
      const dip = { x: mcp.x + dirX * 0.3, y: mcp.y + dirY * 0.08, z: mcp.z + 0.02 };
      const tip = { x: mcp.x + dirX * 0.18, y: mcp.y + 0.02, z: mcp.z + 0.06 };
      return [pip, dip, tip];
    } else {
      // touching (towards thumb tip at ~0.42, 0.52)
      const pip = { x: mcp.x - 0.03, y: mcp.y - 0.08, z: -0.03 };
      const dip = { x: 0.44, y: 0.54, z: -0.02 };
      const tip = { x: 0.42, y: 0.56, z: 0 };
      return [pip, dip, tip];
    }
  };

  // Thumb special generation
  let thumbIp = { x: 0.36, y: 0.62, z: -0.06 };
  let thumbTip = { x: 0.32, y: 0.54, z: -0.08 };

  if (reqs.thumb === 'folded') {
    thumbIp = { x: 0.44, y: 0.66, z: 0.04 };
    thumbTip = { x: 0.48, y: 0.64, z: 0.05 };
  } else if (reqs.thumb === 'touching') {
    thumbIp = { x: 0.42, y: 0.6, z: 0.01 };
    thumbTip = { x: 0.44, y: 0.55, z: 0.02 };
  } else if (reqs.thumb === 'curled') {
    thumbIp = { x: 0.38, y: 0.62, z: -0.02 };
    thumbTip = { x: 0.42, y: 0.58, z: 0.02 };
  }

  const [indexPip, indexDip, indexTip] = getFingerPoints(indexMcp, reqs.index, -0.03, -0.32);
  const [middlePip, middleDip, middleTip] = getFingerPoints(middleMcp, reqs.middle, 0, -0.35);
  const [ringPip, ringDip, ringTip] = getFingerPoints(ringMcp, reqs.ring, 0.03, -0.32);
  const [pinkyPip, pinkyDip, pinkyTip] = getFingerPoints(pinkyMcp, reqs.pinky, 0.06, -0.28);

  const landmarks = [
    wrist, // 0
    thumbCmc, // 1
    thumbMcp, // 2
    thumbIp, // 3
    thumbTip, // 4
    indexMcp, // 5
    indexPip, // 6
    indexDip, // 7
    indexTip, // 8
    middleMcp, // 9
    middlePip, // 10
    middleDip, // 11
    middleTip, // 12
    ringMcp, // 13
    ringPip, // 14
    ringDip, // 15
    ringTip, // 16
    pinkyMcp, // 17
    pinkyPip, // 18
    pinkyDip, // 19
    pinkyTip, // 20
  ];

  if (overrides) {
    for (const [idxStr, pt] of Object.entries(overrides)) {
      const idx = Number(idxStr);
      if (landmarks[idx] && pt) {
        landmarks[idx] = { ...landmarks[idx], ...pt };
      }
    }
  }

  return {
    id,
    name,
    landmarks,
    description,
    fingerRequirements: reqs,
    tips,
  };
}

export const CANONICAL_REFERENCE_POSES: Record<string, ReferencePose> = {
  hello: createCanonicalPose(
    'hello',
    'HELLO / OPEN HAND',
    'All 5 fingers fully extended and spread comfortably, palm facing camera.',
    { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    ['Extend all 5 fingers fully.', 'Ensure your palm faces forward toward the lens.']
  ),
  'thank-you': createCanonicalPose(
    'thank-you',
    'THANK YOU',
    'Flat hand extended forward with fingers joined together.',
    { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    ['Keep fingers tight together.', 'Extend hand smoothly outward.']
  ),
  please: createCanonicalPose(
    'please',
    'PLEASE',
    'Open flat palm placed on the chest ready for gentle circular motion.',
    { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    ['Maintain a flat, relaxed palm.', 'Rub gently over the center of the chest.']
  ),
  yes: createCanonicalPose(
    'yes',
    'YES / FIST',
    'All fingers folded tightly into an S-fist.',
    { thumb: 'folded', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    ['Fold all four fingers into a tight fist.', 'Rest thumb across the fingers.', 'Nod wrist slightly.']
  ),
  no: createCanonicalPose(
    'no',
    'NO / PINCH SNAP',
    'Index and middle fingers pinched together to touch the thumb tip.',
    { thumb: 'touching', index: 'touching', middle: 'touching', ring: 'folded', pinky: 'folded' },
    ['Bring index and middle tips to touch your thumb.', 'Keep ring and pinky neatly folded.']
  ),
  'i-love-you': createCanonicalPose(
    'i-love-you',
    'I LOVE YOU (ILY)',
    'Thumb, index, and pinky fingers extended upright, while middle and ring are folded.',
    { thumb: 'extended', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'extended' },
    ['Extend thumb, index, and pinky straight.', 'Ensure middle and ring are tucked into the palm.'],
    {
      4: { x: 0.28, y: 0.56, z: -0.06 },
      8: { x: 0.44, y: 0.22, z: -0.04 },
      20: { x: 0.68, y: 0.32, z: -0.03 },
    }
  ),
  peace: createCanonicalPose(
    'peace',
    'PEACE / 2',
    'Index and middle fingers extended into a crisp V shape, others folded.',
    { thumb: 'folded', index: 'extended', middle: 'extended', ring: 'folded', pinky: 'folded' },
    ['Spread index and middle into a clear V shape.', 'Tuck thumb over ring finger.']
  ),
  okay: createCanonicalPose(
    'okay',
    'OKAY / LETTER F',
    'Thumb and index tips touching in an O-ring, while middle, ring, pinky stand upright.',
    { thumb: 'touching', index: 'touching', middle: 'extended', ring: 'extended', pinky: 'extended' },
    ['Pinch index and thumb tips together in a circle.', 'Keep other three fingers tall and spread.']
  ),
  'thumbs-up': createCanonicalPose(
    'thumbs-up',
    'THUMBS UP / APPROVE',
    'Closed fist with thumb extended straight upward.',
    { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    ['Point thumb vertically straight up.', 'Keep other 4 fingers firmly curled into fist.'],
    { 4: { x: 0.42, y: 0.38, z: -0.04 } }
  ),
  help: createCanonicalPose(
    'help',
    'HELP',
    'Dominant hand in thumbs-up fist lifted with open palm support.',
    { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    ['Hold thumbs up fist steady in front of chest.']
  ),
  'as-a': createCanonicalPose(
    'asl-a',
    'LETTER A',
    'Fist with thumb resting upright along the outer edge of index finger.',
    { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    ['Keep thumb upright along the side of the fist, not tucked across.'],
    { 4: { x: 0.38, y: 0.54, z: -0.02 } }
  ),
  'asl-b': createCanonicalPose(
    'asl-b',
    'LETTER B',
    'Four fingers extended upright together, thumb tucked across palm.',
    { thumb: 'folded', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    ['Press all four fingers together without gaps.', 'Tuck thumb flat across palm.']
  ),
  'asl-c': createCanonicalPose(
    'asl-c',
    'LETTER C',
    'All fingers and thumb curved into an open C arc.',
    { thumb: 'curled', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' },
    ['Curve fingers smoothly like grasping a cup.', 'View from the profile for clearest shape.']
  ),
  'asl-d': createCanonicalPose(
    'asl-d',
    'LETTER D',
    'Index finger pointing straight up, thumb touching middle, ring, pinky tips.',
    { thumb: 'touching', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' },
    ['Point index finger straight up.', 'Touch thumb tip to curled middle & ring tips.']
  ),
  'asl-l': createCanonicalPose(
    'asl-l',
    'LETTER L',
    'Index pointing up, thumb sticking out horizontally at 90 degrees.',
    { thumb: 'extended', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'folded' },
    ['Form a crisp right angle with thumb and index.', 'Fold other fingers tightly into palm.'],
    { 4: { x: 0.26, y: 0.68, z: -0.03 }, 8: { x: 0.45, y: 0.22, z: -0.02 } }
  ),
  'asl-w': createCanonicalPose(
    'asl-w',
    'LETTER W / 3',
    'Index, middle, and ring fingers spread upright, pinky held down by thumb.',
    { thumb: 'touching', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'folded' },
    ['Spread index, middle, and ring upright.', 'Hold pinky down with thumb tip.']
  ),
  'asl-y': createCanonicalPose(
    'asl-y',
    'LETTER Y / SHAKA',
    'Thumb and pinky extended wide, middle three fingers folded down.',
    { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'extended' },
    ['Extend thumb and pinky wide apart.', 'Keep middle 3 fingers curled into palm.'],
    { 4: { x: 0.26, y: 0.58, z: -0.05 }, 20: { x: 0.72, y: 0.42, z: -0.04 } }
  ),
};

// Map dictionary ID to reference pose ID
export function getReferencePose(signId: string): ReferencePose {
  const cleanId = signId.toLowerCase().replace(/_/g, '-');
  if (CANONICAL_REFERENCE_POSES[cleanId]) {
    return CANONICAL_REFERENCE_POSES[cleanId];
  }
  // Search by keyword
  for (const [key, pose] of Object.entries(CANONICAL_REFERENCE_POSES)) {
    if (cleanId.includes(key) || key.includes(cleanId)) {
      return pose;
    }
  }
  // Default to Hello/Open Hand
  return CANONICAL_REFERENCE_POSES['hello'];
}

/**
 * Normalizes 21 landmarks:
 * 1. Center at wrist (0, 0, 0)
 * 2. Scale by distance between wrist and middle MCP
 * 3. Mirror X if Left Hand is used so matching is symmetrical for both hands!
 */
export function normalizeLandmarks(
  rawLandmarks: HandLandmark[],
  handedness: 'Left' | 'Right'
): { x: number; y: number; z: number }[] {
  if (!rawLandmarks || rawLandmarks.length < 21) {
    return [];
  }

  const wrist = rawLandmarks[0];
  const middleMcp = rawLandmarks[9];

  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const dz = (middleMcp.z || 0) - (wrist.z || 0);
  const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

  return rawLandmarks.map((pt) => {
    let relX = (pt.x - wrist.x) / scale;
    const relY = (pt.y - wrist.y) / scale;
    const relZ = ((pt.z || 0) - (wrist.z || 0)) / scale;

    // If Left Hand, mirror along X axis so it aligns with canonical Right Hand model
    if (handedness === 'Left') {
      relX = -relX;
    }

    return { x: relX, y: relY, z: relZ };
  });
}

/**
 * Calculate distance between two 3D points
 */
function dist3D(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Evaluates hand landmark mimic accuracy in real-time against target reference pose.
 * Supports both Left and Right hands with automatic anatomical mirroring.
 */
export function evaluateLandmarkMatch(
  userRawLandmarks: HandLandmark[],
  detectedHandedness: 'Left' | 'Right',
  targetSignId: string,
  preferredHandedness: 'Left' | 'Right' | 'Auto' = 'Auto'
): LandmarkMatchResult {
  const effectiveHandedness: 'Left' | 'Right' =
    preferredHandedness === 'Auto' ? detectedHandedness : preferredHandedness;

  const targetPose = getReferencePose(targetSignId);

  // Fallback empty result if no hand detected
  if (!userRawLandmarks || userRawLandmarks.length < 21) {
    return {
      signId: targetPose.id,
      signName: targetPose.name,
      overallScore: 0,
      isMatched: false,
      fingerAccuracies: {
        thumb: { name: 'thumb', score: 0, status: 'adjust', tip: 'Bring hand into camera frame' },
        index: { name: 'index', score: 0, status: 'adjust', tip: 'Hand not detected' },
        middle: { name: 'middle', score: 0, status: 'adjust', tip: 'Hand not detected' },
        ring: { name: 'ring', score: 0, status: 'adjust', tip: 'Hand not detected' },
        pinky: { name: 'pinky', score: 0, status: 'adjust', tip: 'Hand not detected' },
      },
      palmOrientationScore: 0,
      detectedHandedness,
      targetHandedness: effectiveHandedness,
      correctiveFeedback: ['Place your hand clearly within the camera signing frame.'],
      normalizedUserLandmarks: [],
      normalizedRefLandmarks: targetPose.landmarks,
      keypointErrors: new Array(21).fill(1),
    };
  }

  // Normalize user landmarks (mirrored if left hand)
  const normUser = normalizeLandmarks(userRawLandmarks, effectiveHandedness);
  // Normalize reference landmarks
  const normRef = normalizeLandmarks(
    targetPose.landmarks.map((l) => ({ ...l, visibility: 1 })),
    'Right'
  );

  // Keypoint Euclidean Distance Errors
  const keypointErrors: number[] = [];
  let totalError = 0;

  for (let i = 0; i < 21; i++) {
    const error = dist3D(normUser[i], normRef[i]);
    keypointErrors.push(error);
    totalError += error;
  }

  // Helper to score a finger based on MCP, PIP, DIP, TIP errors
  const scoreFinger = (
    indices: number[],
    reqState: 'extended' | 'folded' | 'touching' | 'curled',
    fingerName: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'
  ): FingerAccuracy => {
    let fingerErr = 0;
    for (const idx of indices) {
      fingerErr += keypointErrors[idx];
    }
    const avgErr = fingerErr / indices.length;

    // Error curve: 0.15 error = 100%, 0.8 error = 0%
    const score = Math.max(0, Math.min(100, Math.round((1 - (avgErr - 0.15) / 0.65) * 100)));
    const status: 'perfect' | 'good' | 'adjust' =
      score >= 85 ? 'perfect' : score >= 65 ? 'good' : 'adjust';

    let tip = 'Position aligned';
    if (status === 'adjust') {
      if (reqState === 'extended') tip = `Extend ${fingerName} straight up`;
      else if (reqState === 'folded') tip = `Fold ${fingerName} tightly into palm`;
      else if (reqState === 'touching') tip = `Touch ${fingerName} tip to thumb`;
      else if (reqState === 'curled') tip = `Curve ${fingerName} into arc`;
    }

    return { name: fingerName, score, status, tip };
  };

  const thumbAcc = scoreFinger([1, 2, 3, 4], targetPose.fingerRequirements.thumb, 'thumb');
  const indexAcc = scoreFinger([5, 6, 7, 8], targetPose.fingerRequirements.index, 'index');
  const middleAcc = scoreFinger([9, 10, 11, 12], targetPose.fingerRequirements.middle, 'middle');
  const ringAcc = scoreFinger([13, 14, 15, 16], targetPose.fingerRequirements.ring, 'ring');
  const pinkyAcc = scoreFinger([17, 18, 19, 20], targetPose.fingerRequirements.pinky, 'pinky');

  // Palm orientation score (based on wrist to index/pinky MCP plane)
  const palmDist = (keypointErrors[0] + keypointErrors[5] + keypointErrors[17]) / 3;
  const palmScore = Math.max(0, Math.min(100, Math.round((1 - (palmDist - 0.1) / 0.6) * 100)));

  // Weighted overall accuracy score
  const overallScore = Math.round(
    thumbAcc.score * 0.22 +
      indexAcc.score * 0.22 +
      middleAcc.score * 0.2 +
      ringAcc.score * 0.18 +
      pinkyAcc.score * 0.18
  );

  const isMatched = overallScore >= 78;

  // Build actionable dynamic feedback items
  const correctiveFeedback: string[] = [];

  if (overallScore >= 88) {
    correctiveFeedback.push('🌟 Outstanding accuracy! Hold position to confirm.');
  } else if (overallScore >= 78) {
    correctiveFeedback.push('✅ Great alignment! Keep hand steady.');
  } else {
    // List highest error fingers
    const fingers = [thumbAcc, indexAcc, middleAcc, ringAcc, pinkyAcc];
    const lowest = fingers.sort((a, b) => a.score - b.score).filter((f) => f.score < 75);

    if (lowest.length > 0 && lowest[0].tip) {
      correctiveFeedback.push(lowest[0].tip);
    }
    if (lowest.length > 1 && lowest[1].tip) {
      correctiveFeedback.push(lowest[1].tip);
    }
    if (palmScore < 70) {
      correctiveFeedback.push('Rotate palm to face camera squarely.');
    }
  }

  // Add target pose specific tips
  if (targetPose.tips.length > 0 && correctiveFeedback.length < 3) {
    correctiveFeedback.push(targetPose.tips[0]);
  }

  return {
    signId: targetPose.id,
    signName: targetPose.name,
    overallScore,
    isMatched,
    fingerAccuracies: {
      thumb: thumbAcc,
      index: indexAcc,
      middle: middleAcc,
      ring: ringAcc,
      pinky: pinkyAcc,
    },
    palmOrientationScore: palmScore,
    detectedHandedness,
    targetHandedness: effectiveHandedness,
    correctiveFeedback,
    normalizedUserLandmarks: normUser,
    normalizedRefLandmarks: targetPose.landmarks,
    keypointErrors,
  };
}
