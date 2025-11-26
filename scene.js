import * as THREE from 'three';
import { rotation, roundWithPrecision } from './la.js';

const REAL_IPD = 0.063; // 6.3 cm

export default class Scene {
    constructor(video_stream) {
        this.video_stream = video_stream;
        this.initFaceDetection();

        this.scene = new THREE.Scene();
        this.first_render = true;
        this._smoothPos = new THREE.Vector3(0, 0, 0); 

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

        let scaledW, scaledH;

        if (screenAspect > videoAspect) {
            // screen is wider → match width
            scaledW = sw;
            scaledH = sw / videoAspect;
        } else {
            // screen is taller → match height
            scaledH = sh;
            scaledW = sh * videoAspect;
        }

        // In ortho we use pixel units: set plane size to scaledW x scaledH.
        // Mirror horizontally to match webcam mirror.
        this.video_mesh.scale.set(-scaledW, scaledH, 1);

        // Keep track for coordinate conversion
        this._videoScaledW = Math.abs(scaledW);
        this._videoScaledH = scaledH;
        this._videoLeft = (sw - this._videoScaledW) / 2;
        this._videoTop  = (sh - this._videoScaledH) / 2;

        // store ratio for mapping video pixels to scaled pixels
        this.videoScale = this._videoScaledW / vw;
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
        const geo = new THREE.PlaneGeometry(5, 5);
        const mat = new THREE.MeshBasicMaterial({color: 0xffffff});
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


// ----- map video pixel coords (px,py) -> canvas pixel coords -----
    videoPixelToCanvasPixel(px, py) {
        // px,py are in video pixel space (0..videoWidth, 0..videoHeight)
        const vw = this.video_stream.videoWidth;
        const vh = this.video_stream.videoHeight;
        if (!vw || !vh || !this._videoScaledW) return { x: 0, y: 0 };

        // px proportion within video
        const nx = px / vw;
        const ny = py / vh;

        // canvas position (top-left origin)
        const cx = this._videoLeft + nx * this._videoScaledW;
        const cy = this._videoTop  + ny * this._videoScaledH;

        return { x: cx, y: cy };
    }

    // ----- map canvas pixel -> world point along camera ray, at a given distance from camera -----
    screenPixelToWorldAtDistance(canvasX, canvasY, camera) {
        // NDC
        const ndc = new THREE.Vector3(
            (canvasX / this.renderer.domElement.clientWidth) * 2 - 1,
            -(canvasY / this.renderer.domElement.clientHeight) * 2 + 1,
            -1
        );

        // point on near-mid plane in world coords
        const worldPoint = ndc.unproject(camera);

        return worldPoint
    }

        screenToWorldAtZ(canvasX, canvasY, camera, targetZ) {
        const mouse = new THREE.Vector2(
            (canvasX / this.renderer.domElement.clientWidth) * 2 - 1,
            -(canvasY / this.renderer.domElement.clientHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // Ray: origin + dir * t
        const origin = raycaster.ray.origin;
        const dir = raycaster.ray.direction;

        const t = (targetZ - origin.z) / dir.z;

        return origin.clone().add(dir.multiplyScalar(t));
    }


getFocalLengthPixels(videoWidth, fovDeg) {
    return (videoWidth / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
}

// Abstand zwischen den Augen in Pixeln (FaceMesh Keypoints)
getEyePixelDistance(f) {
    // FaceMesh landmarks:
    // 33 = left eye outer corner
    // 263 = right eye outer corner

    const L = f.keypoints[33];
    const R = f.keypoints[263];

    const dx = L.x - R.x;
    const dy = L.y - R.y;

    return Math.sqrt(dx*dx + dy*dy);
}

// Hauptfunktion: berechnet Tiefe in Metern
computeRealDepthFromEyes(f) {
    const videoWidth = this.video_stream.videoWidth;
    const fov = 65; // typisches Webcam-FOV, kann kalibriert werden

    const f_px = this.getFocalLengthPixels(videoWidth, fov);

    const eyePx = this.getEyePixelDistance(f);

    if (eyePx < 1) return null;

    // Perspektivische Tiefenformel
    const distanceMeters = (REAL_IPD * f_px) / eyePx;

    return distanceMeters;
}

// Optional: mappe echte Meter in deine gewünschte Szene-Z-Tiefe
mapDepthMetersToSceneZ(m) {
    // Deine Kamera steht bei z = 50 → mappe Meter logisch
    // m = 0.5m → nah, m = 1.5m → weit
    return THREE.MathUtils.mapLinear(m, 0.4, 1.2, 20, -30);
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

        if(!this.face || !this.face.length) {
            this.box3D.position.z = -10000;

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
            const forehead = f.keypoints[10]

            if(this.first_render) console.log(f);
            this.first_render = false;




            if (leftEye && rightEye && chin) {


                const rotY = rotation(leftEye.z, rightEye.z, leftEye.x, rightEye.x); // Yaw
                const rotZ = rotation(leftEye.y, rightEye.y, leftEye.x, rightEye.x); // Roll
                const rotX = rotation(
                    f.keypoints[152].z,
                    f.keypoints[10].z, 
                    f.keypoints[152].y, 
                    f.keypoints[10].y, 
                );     // Pitch ✔️
                

                this.box3D.rotation.y = rotY;
                this.box3D.rotation.z = -rotZ;
                this.box3D.rotation.x =  rotX;

                // Compute world position along perspective camera ray
                const canvas_pixel = this.videoPixelToCanvasPixel(forehead.x, forehead.y);

                            // === Depth über Eye Distance ===
                const depthMeters = this.computeRealDepthFromEyes(f);

                // mappe in SZENE-Z
                const headZ = this.mapDepthMetersToSceneZ(depthMeters);

                // Glätten (sehr wichtig)
                this._smoothZ = this._smoothZ ?? headZ;
                this._smoothZ = THREE.MathUtils.lerp(this._smoothZ, headZ, 0.15);

            

                const worldPos = this.screenToWorldAtZ(canvas_pixel.x, canvas_pixel.y, this.perspCam, this._smoothZ);


                // optional Offset auf Y (z.B. Kopfspitze)
                const targetPos = new THREE.Vector3(worldPos.x, worldPos.y + 2.5, this._smoothZ);

                // Glätte mit Lerp (0.1–0.2 = sanft, 0.3–0.5 = schneller)
                this._smoothPos.lerp(targetPos, 0.5);

                // setze Box3D Position
                this.box3D.position.copy(this._smoothPos);
            
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
