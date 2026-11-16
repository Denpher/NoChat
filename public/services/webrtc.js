/**
 * NoChat v4 - WebRTC Video & Webcam Calling Service
 * Front camera default, camera flip, mic mute, and browser permissions fallback.
 */

let localStream = null;
let currentFacingMode = 'user'; // Front camera default
let isMicMuted = false;
let isVideoMuted = false;

export async function startCamera(videoElement, facingMode = 'user') {
  currentFacingMode = facingMode;
  try {
    if (localStream) {
      stopCamera();
    }

    const constraints = {
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (videoElement) {
      videoElement.srcObject = localStream;
      videoElement.play().catch(() => {});
    }
    return { stream: localStream, error: null };
  } catch (err) {
    console.error('[WebRTC] Camera access failed:', err);
    let userMsg = 'Camera and microphone access denied. Allow from browser settings to make video calls.';
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      userMsg = 'No camera or microphone found on this device.';
    }
    return { stream: null, error: userMsg };
  }
}

export async function flipCamera(videoElement) {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  return startCamera(videoElement, currentFacingMode);
}

export function toggleMuteMic() {
  if (!localStream) return false;
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMicMuted;
  });
  return isMicMuted;
}

export function toggleMuteVideo() {
  if (!localStream) return false;
  isVideoMuted = !isVideoMuted;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = !isVideoMuted;
  });
  return isVideoMuted;
}

export function stopCamera() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}
