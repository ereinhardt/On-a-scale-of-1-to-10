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

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        try {
          const stream = videoElement.srcObject;
          const videoTrack = stream ? stream.getVideoTracks()[0] : null;

          if (
            !stream ||
            !videoTrack ||
            videoTrack.readyState === "ended" ||
            videoElement.paused
          ) {
            if (
              videoTrack &&
              videoTrack.readyState === "live" &&
              videoElement.paused
            ) {
              await videoElement.play();
            } else {
              const newStream =
                await navigator.mediaDevices.getUserMedia(CAMERA_OPTIONS);
              videoElement.srcObject = newStream;
              await videoElement.play();
            }
          }
        } catch (e) {
          //   console.error("Error resuming camera:", e);
        }
      }
    });
  } catch (error) {
    // console.error(error);
    alert(
      "Camera not found. Please make sure you have a camera connected and have granted permission to use it.",
    );
  }
}

setupCamera();
