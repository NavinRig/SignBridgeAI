# SignBridge AI 🤟

SignBridge AI is an accessible, real-time bidirectional American Sign Language (ASL) translator and video conferencing companion. It bridges communication gaps during remote work meetings, classrooms, and daily conversations with sub-second hand & facial emotion landmark tracking, speech synthesis, a 50-emotion interactive sign avatar, and seamless cloud persistence.

---

## 🌟 Key Features

1. **Camera-Responsive ASL Avatar**:
   - **Responsive Interaction**: Automatically reacts when the person in the camera feed performs hand gestures (e.g. *Hello, Thank You, Yes, No, Help, I Love You, Peace, Good*) or facial emotions (*Happy, Surprised, Focused, Inquisitive, Excited*).
   - **Attentive ASL Ready Pose**: When the signer is not gesturing or emoting, the avatar holds a natural, respectful ASL rest posture with gentle micro-breathing motion and natural blinking.
   - **50 ASL Emotion Library**: Complete vector-rigged library spanning 50 emotions and non-manual markers with search, playback speed control (0.5x–2.0x), English dialogue synthesis, and randomized shuffle.

2. **Google Meet-Style Background Blur (0–80% Slider)**:
   - Visual Effects drawer modeled after Google Meet.
   - Real-time blur intensity slider allowing adjustment up to 80% blur (mapped smoothly from 0px up to 35px blur).
   - Presets for quick switching: *No Blur (0%)*, *Light Blur (25%)*, *Medium Blur (50%)*, and *Maximum Blur (80%)*.
   - Signer preservation mask that keeps hands, fingers, and facial landmarks sharp while defocusing background distractions.

3. **Dynamic Face & Facial Landmark Tracking**:
   - Immediate face detection as soon as any face enters the camera frame.
   - Dual-zone skin-tone clustering and luminance-gradient landmark anchors for eyes, nose, and mouth.
   - Visual tracking indicator displaying real-time tracking status: *Face Tracked (Stable / Locked)* vs. *Scanning for Face*.
   - Real-time non-manual marker (NMM) analysis: smile confidence, brow raise/furrow, cheek puff, and head tilt.

4. **Bidirectional Sign & Speech Engine**:
   - **Sign → Speech**: Translates real-time camera signs into natural, fluent English using Gemini 2.5 Flash and plays them aloud via the Web Speech Synthesis API.
   - **Speech → Sign**: Captures incoming microphone audio and converts spoken sentences into ASL gloss and avatar animations.

5. **Secure Cloud Firestore Persistence**:
   - Automatic cloud sync for user meeting transcripts, sign mastery scores, and display preferences.
   - Strict Attribute-Based Access Control (ABAC) isolating user data to `/users/{userId}/*`.

---

## 🚀 Deployment Guide

### 1. Prerequisites

- **Node.js**: Version 18.x or 20.x+
- **npm**: Version 9.x+
- **Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)
- **Firebase Project**: Configured with Cloud Firestore and Firebase Authentication (Google Sign-In)

### 2. Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
# Gemini API Key (Server-Side Only - DO NOT prefix with VITE_)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration (Public Client-Side)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### 3. Local Development

Install dependencies and boot the development server:

```bash
# Install dependencies
npm install

# Start development server (serves on http://localhost:3000)
npm run dev
```

### 4. Production Build & Execution

Build both the client-side Vite bundle and the Node.js Express server bundle:

```bash
# Compile client assets into dist/ and bundle server.ts into dist/server.cjs
npm run build

# Start production server on port 3000
npm run start
```

### 5. Cloud Run / Docker Container Deployment

SignBridge AI is container-ready. Use the following Dockerfile configuration:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

Build and deploy to Google Cloud Run:

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/signbridge-ai
gcloud run deploy signbridge-ai \
  --image gcr.io/YOUR_PROJECT_ID/signbridge-ai \
  --platform managed \
  --port 3000 \
  --allow-unauthenticated
```

---

## 🔒 Cloud Firestore Security Rules

The application enforces Attribute-Based Access Control (ABAC) and Strict Data Isolation. Users can only read, write, update, and delete their own private collections (`/users/{userId}/*`). All documents require active Firebase Authentication, valid document IDs, and strict schema validation.

Below are the complete, deployed Firestore security rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Default deny all documents by default
    match /{document=**} {
      allow read, write: if false;
    }

    // Connection validation endpoint
    match /test/{docId} {
      allow read: if true;
    }

    // Security helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    function isValidTranscript(data) {
      return data.userId == request.auth.uid &&
        data.id is string && data.id.size() <= 128 &&
        data.timestamp is number &&
        data.type in ['sign_to_speech', 'speech_to_sign', 'system', 'gesture_stream'] &&
        data.naturalText is string && data.naturalText.size() <= 2000 &&
        data.speaker is string && data.speaker.size() <= 100 &&
        data.confidence is number && data.confidence >= 0.0 && data.confidence <= 1.0 &&
        data.bookmarked is bool;
    }

    function isValidUserPreferences(data) {
      return data.userId == request.auth.uid &&
        data.backgroundBlur in ['off', 'subtle', 'medium', 'deep', 'bokeh'] &&
        data.updatedAt is number;
    }

    function isValidSignMastery(data) {
      return data.userId == request.auth.uid &&
        data.signId is string && data.signId.size() <= 128 &&
        data.signName is string && data.signName.size() <= 100 &&
        data.bestScore is number &&
        data.completed is bool &&
        data.timestamp is number;
    }

    // User-scoped data isolation (Attribute-Based Access Control)
    match /users/{userId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;

      // User Transcripts
      match /transcripts/{transcriptId} {
        allow get, list: if isSignedIn() && request.auth.uid == userId;
        allow create: if isSignedIn() && request.auth.uid == userId && isValidId(transcriptId) && isValidTranscript(incoming());
        allow update: if isSignedIn() && request.auth.uid == userId && isValidId(transcriptId) && isValidTranscript(incoming()) && incoming().userId == existing().userId;
        allow delete: if isSignedIn() && request.auth.uid == userId && isValidId(transcriptId);
      }

      // User Preferences & Background Blur
      match /preferences/{settingId} {
        allow get, list: if isSignedIn() && request.auth.uid == userId;
        allow create, update: if isSignedIn() && request.auth.uid == userId && isValidId(settingId) && isValidUserPreferences(incoming());
        allow delete: if isSignedIn() && request.auth.uid == userId && isValidId(settingId);
      }

      // Sign Trainer Mastery
      match /mastery/{signId} {
        allow get, list: if isSignedIn() && request.auth.uid == userId;
        allow create, update: if isSignedIn() && request.auth.uid == userId && isValidId(signId) && isValidSignMastery(incoming());
        allow delete: if isSignedIn() && request.auth.uid == userId && isValidId(signId);
      }
    }
  }
}
```

### Deploying Rules to Firebase

To deploy these security rules to your active Firebase project:

```bash
# 1. Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# 2. Authenticate with Google
firebase login

# 3. Associate with your project
firebase use <YOUR_FIREBASE_PROJECT_ID>

# 4. Deploy only the Firestore security rules
firebase deploy --only firestore:rules
```

---

## 🎭 50 ASL Avatar Emotions Index

The avatar expression engine supports 50 distinct emotions across 5 grammatical & contextual categories:

1. **Joy & Warmth**: Happy, Joyful, Excited, Proud, Grateful, Friendly, Affectionate, Peaceful, Amused, Relieved.
2. **Inquiry & Questions**: Inquisitive, Puzzled, Curious, Skeptical, WH-Question, Yes/No Question, Thoughtful, Wondering, Hesitant, Perplexed.
3. **Focus & Determination**: Confident, Serious, Determined, Focused, Alert, Professional, Patient, Stern, Persistent, Resilient.
4. **Empathy & Soft Reactions**: Empathetic, Apologetic, Shy, Gentle, Nostalgic, Vulnerable, Receptive, Reassuring, Compassionate, Modest.
5. **Surprise & High Energy**: Surprised, Shocked, Thrilled, Amazed, Energetic, Triumphant, Eager, Astonished, Inspiring, Celebratory.
