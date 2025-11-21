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
        //const size = calculateVideoSize();
        const geometry = new THREE.PlaneGeometry(
            window.screen.width,
            window.screen.height,
        );



        geometry.scale(-1,1,1);

        const video_texture = new THREE.VideoTexture(this.video_stream
        );

        video_texture.wrapS = THREE.RepeatWrapping;
        video_texture.wrapT = THREE.RepeatWrapping;

        video_texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            map: video_texture,
            side: THREE.DoubleSide
        });

        this.video_mesh = new THREE.Mesh(geometry, material);
        this.video_mesh.position.set(0, 0, 0);

        this.scene.add(this.video_mesh);
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

        });
    }

    


   


async animate() {

    if(this.detector) {
        const options = {maxFaces: 1, flipHorizontal: true};
        this.face = await this.detector.estimateFaces(this.video_stream, options);
    }

    // Render Bounding Box
    if (this.face && this.face.length > 0) {
        const box = this.face[0].box;

        const videoW = this.video_stream.videoWidth;
        const videoH = this.video_stream.videoHeight;

        if (videoW > 0 && videoH > 0) {

            const w = box.width;
            const h = box.height;

            const cx = box.xMin + w / 2;
            const cy = box.yMin + h / 2;

            const worldX = cx - videoW / 2;
            const worldY = videoH / 2 - cy;

            this.bbox.scale.set(w, h, 1);
            this.bbox.position.set(worldX, worldY, 0.5);
        }
    }

    this.renderer.render(this.scene, this.camera);
}
}
