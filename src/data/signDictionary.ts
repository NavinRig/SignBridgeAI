export interface SignDefinition {
  id: string;
  name: string;
  category: 'alphabet' | 'number' | 'common_phrase' | 'emergency' | 'work_meeting';
  englishMeaning: string;
  aslGloss: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  keyPose: {
    thumb: 'extended' | 'folded' | 'touching';
    index: 'extended' | 'folded' | 'curled' | 'touching';
    middle: 'extended' | 'folded' | 'curled' | 'touching';
    ring: 'extended' | 'folded' | 'curled' | 'touching';
    pinky: 'extended' | 'folded' | 'curled' | 'touching';
  };
  sampleSentences: string[];
  etymology: string;
  tip: string;
}

export const SIGN_DICTIONARY: SignDefinition[] = [
  // Common phrases & Meeting signs
  {
    id: 'hello',
    name: 'HELLO / HI',
    category: 'common_phrase',
    englishMeaning: 'Friendly greeting or wave',
    aslGloss: 'HELLO',
    description: 'Open hand with fingers together, moving from temple outward in a salute-wave motion.',
    difficulty: 'Beginner',
    tags: ['greeting', 'meeting', 'essential'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Hello everyone, nice to meet you.', 'Hi team, welcome to the sprint review.'],
    etymology: 'Derived from a formal salute, evolved into an open-palm warm greeting.',
    tip: 'Keep your palm slightly facing forward with fingers held neatly.'
  },
  {
    id: 'thank-you',
    name: 'THANK YOU',
    category: 'common_phrase',
    englishMeaning: 'Expression of gratitude',
    aslGloss: 'THANK-YOU',
    description: 'Fingertips of dominant flat hand touch lips or chin, then move forward toward the person.',
    difficulty: 'Beginner',
    tags: ['polite', 'essential', 'meeting'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Thank you for the presentation.', 'Thank you for your help.'],
    etymology: 'Symbolizes blowing a blessing or gratitude from the heart and mouth.',
    tip: 'Ensure the hand moves smoothly outward in an arc toward your conversation partner.'
  },
  {
    id: 'please',
    name: 'PLEASE',
    category: 'common_phrase',
    englishMeaning: 'Polite request',
    aslGloss: 'PLEASE',
    description: 'Flat open palm rubbed in a circular clockwise motion over the center of the chest.',
    difficulty: 'Beginner',
    tags: ['polite', 'essential'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Please share your screen.', 'Could you repeat that, please?'],
    etymology: 'Originates from soothing the heart to show polite respect.',
    tip: 'Make 2-3 gentle circles with a light, warm facial expression.'
  },
  {
    id: 'yes',
    name: 'YES / AGREE',
    category: 'common_phrase',
    englishMeaning: 'Affirmation or agreement',
    aslGloss: 'YES',
    description: 'Hand forms an S-fist and rocks up and down from the wrist like a nodding head.',
    difficulty: 'Beginner',
    tags: ['agreement', 'meeting', 'quick_response'],
    keyPose: { thumb: 'folded', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Yes, I can hear you clearly.', 'Yes, I agree with this plan.'],
    etymology: 'The S-fist mimics the human head nodding in agreement.',
    tip: 'Nod your head slightly in sync with the hand motion for natural ASL grammar.'
  },
  {
    id: 'no',
    name: 'NO / DISAGREE',
    category: 'common_phrase',
    englishMeaning: 'Negation or polite decline',
    aslGloss: 'NO',
    description: 'Index and middle fingers snap together to touch the thumb quickly, mimicking a closing beak/mouth.',
    difficulty: 'Beginner',
    tags: ['negation', 'meeting', 'quick_response'],
    keyPose: { thumb: 'touching', index: 'touching', middle: 'touching', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['No, I have not seen the document yet.', 'No questions from my side.'],
    etymology: 'Represents the quick shutting of the mouth or spelling of N-O.',
    tip: 'Deliver with a firm, single or double snap and a subtle head shake.'
  },
  {
    id: 'i-love-you',
    name: 'I LOVE YOU (ILY)',
    category: 'common_phrase',
    englishMeaning: 'Universal sign of love, care, and solidarity',
    aslGloss: 'ILY',
    description: 'Thumb, index finger, and pinky finger extended straight up while middle and ring fingers are folded.',
    difficulty: 'Beginner',
    tags: ['universal', 'friendly', 'care'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'extended' },
    sampleSentences: ['Sending love to the whole community.', 'I love you all!'],
    etymology: 'Combines the manual alphabet letters I, L, and Y into one powerful composite sign.',
    tip: 'Face palm directly outward toward camera.'
  },
  {
    id: 'help',
    name: 'HELP / ASSIST',
    category: 'emergency',
    englishMeaning: 'Requesting or offering assistance',
    aslGloss: 'HELP',
    description: 'Dominant hand in a thumbs-up fist placed onto the flat open palm of the non-dominant hand and lifted upward.',
    difficulty: 'Intermediate',
    tags: ['assistance', 'essential', 'emergency'],
    keyPose: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Can anyone help me with this task?', 'I am happy to help you.'],
    etymology: 'Visual metaphor of lifting or physically supporting someone from beneath.',
    tip: 'Directional verb: moving toward yourself means "help me", moving away means "help you".'
  },
  {
    id: 'nice-to-meet-you',
    name: 'NICE TO MEET YOU',
    category: 'work_meeting',
    englishMeaning: 'Welcoming introduction',
    aslGloss: 'NICE MEET YOU',
    description: 'Dominant hand slides over non-dominant flat palm (NICE), then index fingers of both hands come together facing each other (MEET).',
    difficulty: 'Intermediate',
    tags: ['meeting', 'greeting', 'introduction'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Nice to meet you Navin.', 'Welcome to the team, nice to meet you.'],
    etymology: 'Combines the smooth slide of pleasantness with two human figures meeting.',
    tip: 'Ensure the two index fingers face each other cleanly.'
  },
  {
    id: 'peace',
    name: 'PEACE / VICTORY',
    category: 'common_phrase',
    englishMeaning: 'Peace, calm, or two items',
    aslGloss: 'PEACE / 2',
    description: 'Index and middle fingers extended in a V-shape, palm facing outward.',
    difficulty: 'Beginner',
    tags: ['calm', 'number', 'gesture'],
    keyPose: { thumb: 'folded', index: 'extended', middle: 'extended', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Wishing peace and focus for this meeting.'],
    etymology: 'Standard V shape recognizable worldwide.',
    tip: 'Spread the index and middle fingers evenly in a crisp 45 degree angle.'
  },
  {
    id: 'okay',
    name: 'OKAY / PERFECT',
    category: 'work_meeting',
    englishMeaning: 'Agreement, acknowledgement, or high quality',
    aslGloss: 'OK / PERFECT',
    description: 'Thumb and index fingertips touch to form an O circle while middle, ring, and pinky stand upright.',
    difficulty: 'Beginner',
    tags: ['meeting', 'confirmation', 'positive'],
    keyPose: { thumb: 'touching', index: 'touching', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Okay, let us proceed to the next slide.', 'Everything looks okay on my side.'],
    etymology: 'Manual letter F in ASL alphabet, widely understood as OK or Precise.',
    tip: 'Keep the 3 upright fingers crisp and separated.'
  },
  {
    id: 'thumbs-up',
    name: 'THUMBS UP / APPROVE',
    category: 'work_meeting',
    englishMeaning: 'Positive reaction, approval, or good job',
    aslGloss: 'GOOD / APPROVE',
    description: 'Fist with thumb pointing straight upward.',
    difficulty: 'Beginner',
    tags: ['reaction', 'meeting', 'positive'],
    keyPose: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Great job on the demo!', 'I approve this change.'],
    etymology: 'Universal visual emblem of positivity.',
    tip: 'Hold steady for 1 second for seamless HUD lock.'
  },
  {
    id: 'stop',
    name: 'STOP / PAUSE',
    category: 'work_meeting',
    englishMeaning: 'Halt, pause presentation, or request silence',
    aslGloss: 'STOP',
    description: 'Dominant flat hand with pinky edge chops down firmly into the center of the non-dominant flat palm.',
    difficulty: 'Beginner',
    tags: ['meeting', 'control', 'urgent'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Please stop sharing for a moment.', 'Let us pause the recording.'],
    etymology: 'Visual physical barrier chopping into progress.',
    tip: 'A single crisp downward contact is most easily detected.'
  },
  // ASL Alphabet Key Samples
  {
    id: 'asl-a',
    name: 'LETTER A',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter A',
    aslGloss: 'A',
    description: 'Fist with thumb resting upright beside the folded index finger.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Fingerspelling word: APPLE'],
    etymology: 'Standard manual alphabet.',
    tip: 'Thumb stands tall alongside the index side, not tucked across.'
  },
  {
    id: 'asl-b',
    name: 'LETTER B',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter B',
    aslGloss: 'B',
    description: 'Four fingers upright and together, thumb tucked across the palm.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'folded', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
    sampleSentences: ['Fingerspelling word: BUILD'],
    etymology: 'Standard manual alphabet.',
    tip: 'Keep all four fingers pressed together without gaps.'
  },
  {
    id: 'asl-c',
    name: 'LETTER C',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter C',
    aslGloss: 'C',
    description: 'Hand forms a curved C shape viewed from the side.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'curled' as any, index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' },
    sampleSentences: ['Fingerspelling word: CODE'],
    etymology: 'Iconic letter C profile.',
    tip: 'Curve your fingers in a natural arch.'
  },
  {
    id: 'asl-d',
    name: 'LETTER D',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter D',
    aslGloss: 'D',
    description: 'Index finger pointing straight up, thumb touching middle, ring, and pinky tips in a loop.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'touching', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' },
    sampleSentences: ['Fingerspelling word: DESIGN'],
    etymology: 'Index forms stem, loop forms belly of D.',
    tip: 'Keep index perfectly vertical.'
  },
  {
    id: 'asl-l',
    name: 'LETTER L',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter L',
    aslGloss: 'L',
    description: 'Index pointing straight up, thumb pointing horizontally out at 90 degrees.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'extended', index: 'extended', middle: 'folded', ring: 'folded', pinky: 'folded' },
    sampleSentences: ['Fingerspelling word: LIVE'],
    etymology: 'Iconic shape of capital letter L.',
    tip: 'Keep the 90 degree corner sharp.'
  },
  {
    id: 'asl-w',
    name: 'LETTER W / 3',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter W or Number 3',
    aslGloss: 'W / 3',
    description: 'Index, middle, and ring fingers spread upright, thumb holding pinky down.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'number', 'fingerspelling'],
    keyPose: { thumb: 'touching', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'folded' },
    sampleSentences: ['Fingerspelling word: WORK', 'Count: 3 items.'],
    etymology: 'Three vertical lines forming the W shape.',
    tip: 'Note: in ASL, number 3 is signed with Thumb, Index, Middle, while W is signed with Index, Middle, Ring.'
  },
  {
    id: 'asl-y',
    name: 'LETTER Y',
    category: 'alphabet',
    englishMeaning: 'ASL Alphabet Letter Y',
    aslGloss: 'Y',
    description: 'Thumb and pinky extended wide, middle three fingers folded down.',
    difficulty: 'Beginner',
    tags: ['alphabet', 'fingerspelling'],
    keyPose: { thumb: 'extended', index: 'folded', middle: 'folded', ring: 'folded', pinky: 'extended' },
    sampleSentences: ['Fingerspelling word: YES'],
    etymology: 'The two extended digits form the two arms of letter Y.',
    tip: 'Similar to the Hawaiian shaka sign.'
  }
];
