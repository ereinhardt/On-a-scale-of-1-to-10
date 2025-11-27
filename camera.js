import Scene from "./scene.js";
const CAMERA_OPTIONS = {
  video: {
    facingMode: "user",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_OPTIONS);
    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.id = "camera-stream";

    // IMPORTANT for iOS/Mobile: Video must play inline and be muted for autoplay
    videoElement.setAttribute("playsinline", "");
    videoElement.setAttribute("webkit-playsinline", "");

    await videoElement.play();

    const scene = new Scene(videoElement);
  } catch (error) {
    console.error(error);
  }
}

setupCamera();
