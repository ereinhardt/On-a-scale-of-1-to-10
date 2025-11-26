import * as THREE from 'three';
import { rotation } from './la.js';

export default class Scene {
    constructor(video_stream) {
        this.video_stream = video_stream;
        this.initFaceDetection();

        this.scene = new THREE.Scene();
        this.first_render = true;

        // ------------------------------------
        //  CAMERA 1: ORTHOGRAPHIC (Video + UI)
        // ------------------------------------
        this.createOrthoCamera();

        // ------------------------------------
        //  CAMERA 2: PERSPECTIVE (3D rotation)
        // ------------------------------------
        this.createPerspectiveCamera();

        // RENDERER
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // VIDEO + UI-Layer (Layer 0)
        this.createVideoPlane();
        this.updateVideoScale();

        this.createBoundingBox();

        // 3D-Layer (Layer 1)
        this.create3DObjects();

        this.enableResponsive();

        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    // ============= FACE MESH INIT =============
    async initFaceDetection() {
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const config = {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        };
        this.detector = await faceLandmarksDetection.createDetector(model, config);
    }

    // ===========================================
    // 1) ORTHO CAMERA – EXAKT SCREENBREITE/HÖHE
    // ===========================================
    createOrthoCamera() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.orthoCam = new THREE.OrthographicCamera(
            -w / 2, w / 2,
             h / 2, -h / 2,
            -10, 10
        );

        this.orthoCam.position.z = 2;
        this.orthoCam.layers.enable(0); // Layer0 = Video/UI
    }

    // ===========================================
    // 2) PERSPECTIVE CAMERA – 3D FACE ROTATION
    // ===========================================
    createPerspectiveCamera() {
        this.perspCam = new THREE.PerspectiveCamera(
            40,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );

        this.perspCam.position.set(0, 0, 50);
        this.perspCam.lookAt(0, 0, 0);
        this.perspCam.layers.enable(1); // Layer1 = 3D Rotation-Objects
    }

    // =======================
    // VIDEO PLANE (Layer 0)
    // =======================
    createVideoPlane() {
        const geo = new THREE.PlaneGeometry(1, 1);
        const tex = new THREE.VideoTexture(this.video_stream);
        tex.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });

        this.video_mesh = new THREE.Mesh(geo, mat);
        this.video_mesh.scale.set(-1, 1, 1);
        this.video_mesh.layers.set(0);

        this.scene.add(this.video_mesh);
    }

    updateVideoScale() {
        const vw = this.video_stream.videoWidth;
        const vh = this.video_stream.videoHeight;
        if (!vw || !vh) return;

        const sw = window.innerWidth;
        const sh = window.innerHeight;

        const videoAspect = vw / vh;
        const screenAspect = sw / sh;

        let rw, rh;

        if (screenAspect > videoAspect) {
            rw = sw;
            rh = sw / videoAspect;
        } else {
            rh = sh;
            rw = sh * videoAspect;
        }

        this.video_mesh.scale.set(-rw, rh, 1);
        this.videoScale = rw / vw;
    }

    // ==========================
    // BOUNDING BOX (Layer 0)
    // ==========================
    createBoundingBox() {
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5
        });

        this.bbox = new THREE.Mesh(geo, mat);
        this.bbox.position.z = 1; 
        this.bbox.layers.set(0);

        //this.scene.add(this.bbox);
    }

    // =======================================
    // OPTIONAL: Beispiel-3D-Objekt (Layer 1)
    // =======================================
    create3DObjects() {
        const geo = new THREE.PlaneGeometry(5, 10);
        const mat = new THREE.MeshNormalMaterial();
        this.box3D = new THREE.Mesh(geo, mat)

        this.box3D.position.y = 10;
        

        this.box3D.layers.set(1);
        this.scene.add(this.box3D);
    }

    // ==================
    // RESPONSIVE
    // ==================
    enableResponsive() {
        window.addEventListener("resize", () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            this.renderer.setSize(w, h);

            // ORTHO CAM UPDATES
            this.orthoCam.left   = -w / 2;
            this.orthoCam.right  =  w / 2;
            this.orthoCam.top    =  h / 2;
            this.orthoCam.bottom = -h / 2;
            this.orthoCam.updateProjectionMatrix();

            // PERSPECTIVE CAM UPDATES
            this.perspCam.aspect = w / h;
            this.perspCam.updateProjectionMatrix();

            this.updateVideoScale();
        });
    }

    screenToWorldSpace(point) {
         // 1. Normalisierte Device-Koordinaten (-1..1)
        const ndcX = (point.x / renderer.domElement.clientWidth) * 2 - 1;
        const ndcY = - (point.y / renderer.domElement.clientHeight) * 2 + 1;

    // 2. Erstelle Vektor mit NDC
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5); // z=0.5 mittig
    vec.unproject(camera);

    if (camera.isOrthographicCamera) {
        // Bei Ortho: unproject liefert direkt World-Koordinaten
        return vec;
    } else if (camera.isPerspectiveCamera) {
        // Bei Perspective: Raycast von Kamera durch das Pixel
        const dir = vec.sub(camera.position).normalize();
        const distance = (depthZ - camera.position.z) / dir.z;
        return camera.position.clone().add(dir.multiplyScalar(distance));
    }

    return vec;
    }

    // ==================
    // ANIMATE
    // ==================
    async animate() {
        this.renderer.autoClear = false;
        this.renderer.clear();      


        // === FACE MESH ===
        if (this.detector) {
            const options = { maxFaces: 1, flipHorizontal: true };
            this.face = await this.detector.estimateFaces(this.video_stream, options);
        }

        // === UPDATE BOUNDING BOX ===
        if (this.face && this.face.length) {
            const f = this.face[0];
            const box = f.box;

            const vw = this.video_stream.videoWidth;
            const vh = this.video_stream.videoHeight;

            const scale = this.videoScale;
            if (vw && vh && scale) {

                const w = box.width * scale;
                const h = box.height * scale;

                const cx = box.xMin + box.width / 2;
                const cy = box.yMin + box.height / 2;

                const x = (cx - vw / 2) * scale;
                const y = (vh / 2 - cy) * scale;

                this.bbox.scale.set(w, h, 1);
                this.bbox.position.set(x, y, 1);
            }

            // === UPDATE 3D ROTATION ===
            const leftEye  = f.keypoints.find(e => e.name === "leftEyebrow");
            const rightEye = f.keypoints.find(e => e.name === "rightEyebrow");
            const chin     = f.keypoints[152]

            if(this.first_render) console.log(f);
            this.first_render = false;


            if (leftEye && rightEye && chin) {

                const eyeCenter = {
                    x: (leftEye.x + rightEye.x) / 2,
                    y: (leftEye.y + rightEye.y) / 2,
                    z: (leftEye.z + rightEye.z) / 2
                };

                const rotY = rotation(leftEye.z, rightEye.z, leftEye.x, rightEye.x); // Yaw
                const rotZ = rotation(leftEye.y, rightEye.y, leftEye.x, rightEye.x); // Roll
                const rotX = rotation(
                    f.keypoints[152].z,
                    f.keypoints[10].z, 
                    f.keypoints[152].y, 
                    f.keypoints[10].y, 
                );     // Pitch ✔️
                
                console.log(rotX);

                this.box3D.rotation.y = rotY;
                this.box3D.rotation.z = -rotZ;
                this.box3D.rotation.x =  rotX;
            }



        }



        // ==============================
        // RENDER PASS 1: Video/UI (Layer 0)
        // ==============================
        this.orthoCam.layers.set(0);
        this.renderer.render(this.scene, this.orthoCam);

        this.renderer.clearDepth();

        // ==============================
        // RENDER PASS 2: 3D Objects (Layer 1)
        // ==============================
        this.perspCam.layers.set(1);
        this.renderer.render(this.scene, this.perspCam);

    }
}
