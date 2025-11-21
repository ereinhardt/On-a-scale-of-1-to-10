import Scene from "./scene.js";
const CAMERA_OPTIONS = {
    video: {
        facingMode: 'user',
        width: { ideal: window.screen.width },
        height: { ideal: window.screen.height }
    },
    audio: false
};

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_OPTIONS);
    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.id = 'camera-stream';
    await videoElement.play();

    const scene = new Scene(
        videoElement
    );


}

setupCamera();