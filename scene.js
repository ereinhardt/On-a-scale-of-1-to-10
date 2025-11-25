import * as THREE from 'three';


export default class Scene {
    constructor(video_stream) {
        this.video_stream = video_stream;
        this.initFaceDetection();

        // --- SCENE ---
        this.scene = new THREE.Scene();

        // --- CAMERA ---
        this.camera = new THREE.OrthographicCamera(
            -window.innerWidth / 2,
             window.innerWidth / 2,
             window.innerHeight / 2,
            -window.innerHeight / 2,
             0.001,
             2000
        );
        this.camera.position.z = 1;

        // --- RENDERER ---
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.domElement.id = "scene";
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        document.body.appendChild(this.renderer.domElement);

        // --- VIDEO PLANE ---
        this.createVideoPlane();

        this.createBoundingBox();

        // --- RESIZE HANDLING ---
        this.enableResponsive();

        // --- START LOOP ---
        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    async initFaceDetection() {

        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig = {
        runtime: 'mediapipe', // or 'tfjs'
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        }
        this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    }

    createBoundingBox() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });

    this.bbox = new THREE.Mesh(geometry, material);
    this.bbox.position.z = 0.5; // über dem Video

    this.scene.add(this.bbox);
}


    createVideoPlane() {
        // Wir nutzen eine 1x1 Geometrie und skalieren sie später, 
        // damit wir flexibel auf Änderungen der Video-Auflösung reagieren können.
        const geometry = new THREE.PlaneGeometry(1, 1);

        const video_texture = new THREE.VideoTexture(this.video_stream);
        video_texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            map: video_texture,
            side: THREE.DoubleSide
        });

        this.video_mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.video_mesh);

        // Event-Listener für Video-Größenänderungen (z.B. bei Rotation)
        this.video_stream.addEventListener('resize', () => this.updateVideoScale());

        this.updateVideoScale();
    }

    updateVideoScale() {
        const videoWidth = this.video_stream.videoWidth;
        const videoHeight = this.video_stream.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) return;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const videoAspect = videoWidth / videoHeight;
        const windowAspect = windowWidth / windowHeight;

        // Berechne Skalierungsfaktor, um den Bildschirm zu füllen (Cover)
        if (windowAspect > videoAspect) {
            this.videoScale = windowWidth / videoWidth;
        } else {
            this.videoScale = windowHeight / videoHeight;
        }

        if (this.video_mesh) {
            // Skaliere das 1x1 Mesh auf die Video-Größe * Skalierungsfaktor
            // Negatives X für Spiegelung
            this.video_mesh.scale.set(-videoWidth * this.videoScale, videoHeight * this.videoScale, 1);
        }
    }


    enableResponsive() {
        window.addEventListener("resize", () => {

            // Renderer
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            // Camera
            this.camera.left   = -window.innerWidth / 2;
            this.camera.right  =  window.innerWidth / 2;
            this.camera.top    =  window.innerHeight / 2;
            this.camera.bottom = -window.innerHeight / 2;
            this.camera.updateProjectionMatrix();

            this.updateVideoScale();

        });
    }

    
    calculateHorizontalRotationY() {
        this.horizontalRotationY = Math.atan2(
            this.left_eye.z - this.right_eye.z, 
            this.left_eye.x - this.right_eye.x
        )

    }


    calculateHorizontalRotationZ() {

        this.horizontalRotationZ = Math.atan2(
            this.left_eye.y - this.right_eye.y, 
            this.left_eye.x - this.right_eye.x
        )

    }


async animate() {

    if(this.detector) {
        const options = {maxFaces: 1, flipHorizontal: true};
        this.face = await this.detector.estimateFaces(this.video_stream, options);
    }

    // Render Bounding Box
    if (this.face && this.face.length > 0) {
        const box = this.face[0].box;
        const right_eye = this.face[0].keypoints.find((e) => e.name == "rightEye")
        const left_eye = this.face[0].keypoints.find((e) => e.name == "leftEye")

        if(left_eye) {
            this.left_eye = new THREE.Vector3(left_eye.x, left_eye.y, left_eye.z);
        }

        if(right_eye) {
            this.right_eye = new THREE.Vector3(right_eye.x, right_eye.y, right_eye.z);
        }

        this.calculateHorizontalRotationZ();
        this.calculateHorizontalRotationY();

        const videoW = this.video_stream.videoWidth;
        const videoH = this.video_stream.videoHeight;

        if (videoW > 0 && videoH > 0) {

            const scale = this.videoScale || 1;

            const w = box.width * scale;
            const h = box.height * scale;

            const cx = box.xMin + box.width / 2;
            const cy = box.yMin + box.height / 2;

            const worldX = (cx - videoW / 2) * scale;
            const worldY = (videoH / 2 - cy) * scale;

            this.bbox.scale.set(w, h, 1);
            this.bbox.rotation.z = -this.horizontalRotationZ;

            this.bbox.position.set(worldX, worldY, 0.5);
        }
    }

    this.renderer.render(this.scene, this.camera);
}
}
