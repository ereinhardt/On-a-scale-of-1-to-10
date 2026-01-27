import * as THREE from "three";
import { rotation, OneEuroFilter } from "./la.js";
import { download_image, extractNameFromPath, readJsonFile } from "./util.js";
import Game, { GAME_STATE } from "./game.js";
import ImagePicker from "./image_picker.js";

const REAL_IPD = 0.063; // 6.3 cm

export default class Scene {
  constructor(video_stream) {
    this.video_stream = video_stream;
    this.scene = new THREE.Scene();
    this.first_render = true;
    this.game = new Game();
    this.clock = new THREE.Clock();
    this.animationSpeed = 15; //how many pictures each Sec
    this.delta = 0;
    this.animationIntervall = 1 / this.animationSpeed;
    this.json_path = "item-data/indexed_json.json";
    this.resetTimeout = 3000;
    this.lastSelectedImageBeforeReset = null;

    // Initialize OneEuroFilters
    // minCutoff: lower = smoother when slow (less jitter)
    // beta: higher = faster response when moving (less lag)
    const minCutoff = 0.001;
    const beta = 3.0;

    this.filterX = new OneEuroFilter(minCutoff, beta);
    this.filterY = new OneEuroFilter(minCutoff, beta);
    this.filterZ = new OneEuroFilter(minCutoff, beta);

    this.filterRotX = new OneEuroFilter(minCutoff, beta);
    this.filterRotY = new OneEuroFilter(minCutoff, beta);
    this.filterRotZ = new OneEuroFilter(minCutoff, beta);

    this.lastFaceDetectedTime = 0;

    //  CAMERA 1: ORTHOGRAPHIC (Video + UI)
    this.createOrthoCamera();

    //  CAMERA 2: PERSPECTIVE (3D rotation)
    this.createPerspectiveCamera();

    // RENDERER
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); // High-DPI support (capped at 1.5 for performance)
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // VIDEO + UI-Layer (Layer 0)
    this.createVideoPlane();
    this.updateVideoScale();

    this.createBoundingBox();

    // 3D-Layer (Layer 1)
    this.create3DObjects();

    // this.enableResponsive(); // Removed in favor of checkResize in animate

    this.initImagePicker();
    this.initFaceDetection();
    this.initClickDetection();

    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  async initFaceDetection() {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const config = {
      runtime: "mediapipe",
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
    };
    this.detector = await faceLandmarksDetection.createDetector(model, config);
    this.detectorModel = model;
    this.detectorConfig = config;
  }

  async initImagePicker() {
    this.urls = await readJsonFile(this.json_path);
    const queue_length = Math.floor(30);

    const imagePicker = new ImagePicker(this.urls, queue_length);

    await imagePicker.init();

    this.picker = imagePicker;

    this.game.onImagePlaced((imageItem) => {
      if (imageItem && imageItem.id) {
        this.picker.markAsUsed(imageItem.id);
      }
    });
  }

  onClick() {
    if (!this.picker) return;

    switch (this.game.state) {
      case GAME_STATE.STARTED:
        // New game starts - reset used items
        this.picker.resetUsedItems();
        this.game.start_rolling();
        break;
      case GAME_STATE.READY:
        this.game.start_rolling();
        break;

      case GAME_STATE.ROLLING:
        this.game.stop_rolling();
        break;

      case GAME_STATE.REVEAL_PAUSE:
      case GAME_STATE.REVEALING:
        // Skip reveal and reset game
        this.picker.resetUsedItems();
        this.game.reset();
        break;
    }
  }

  initClickDetection() {
    document
      .getElementsByTagName("canvas")[0]
      .addEventListener("click", this.onClick.bind(this));
  }

  // ORTHO CAMERA – EXACT SCREEN WIDTH/HEIGHT
  createOrthoCamera() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.orthoCam = new THREE.OrthographicCamera(
      -w / 2,
      w / 2,
      h / 2,
      -h / 2,
      -10,
      10,
    );

    this.orthoCam.position.z = 2;
    this.orthoCam.layers.enable(0); // Layer0 = Video/UI
  }

  // PERSPECTIVE CAMERA – 3D FACE ROTATION
  createPerspectiveCamera() {
    this.perspCam = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );

    this.perspCam.position.set(0, 0, 50);
    this.perspCam.lookAt(0, 0, 0);
    this.perspCam.layers.enable(1); // Layer1 = 3D Rotation-Objects
  }

  // VIDEO PLANE (Layer 0)
  createVideoPlane() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const tex = new THREE.VideoTexture(this.video_stream);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
    });

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

    this._videoScaledW = Math.abs(scaledW);
    this._videoScaledH = scaledH;
    this._videoLeft = (sw - this._videoScaledW) / 2;
    this._videoTop = (sh - this._videoScaledH) / 2;

    // store ratio for mapping video pixels to scaled pixels
    this.videoScale = this._videoScaledW / vw;

    // Store screen dimensions for viewport check
    this._screenW = sw;
    this._screenH = sh;

    // Adjust Perspective Camera FOV to match Video Zoom
    // This ensures 3D objects stay in proportion to the video background
    // regardless of cropping (Mobile vs Desktop).
    const videoZoom = scaledH / sh;
    const SENSOR_FOV = 65; // FOV of the short side of the sensor

    let baseFovRad;
    if (vh < vw) {
      baseFovRad = (SENSOR_FOV * Math.PI) / 180;
    } else {
      // Portrait video: Vertical is long side
      // tan(long/2) = tan(short/2) * (long/short)
      const aspect = vh / vw;
      const shortFovRad = (SENSOR_FOV * Math.PI) / 180;
      baseFovRad = 2 * Math.atan(Math.tan(shortFovRad / 2) * aspect);
    }

    // Calculate new vertical FOV based on zoom
    // tan(newFOV/2) = tan(baseFOV/2) / zoom
    const newFovRad = 2 * Math.atan(Math.tan(baseFovRad / 2) / videoZoom);
    const newFovDeg = (newFovRad * 180) / Math.PI;

    this.perspCam.fov = newFovDeg;
    this.perspCam.updateProjectionMatrix();
  }

  // BOUNDING BOX (Layer 0)
  createBoundingBox() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
    });

    this.bbox = new THREE.Mesh(geo, mat);
    this.bbox.position.z = 1;
    this.bbox.layers.set(0);

    //this.scene.add(this.bbox);
  }

  // OPTIONAL: Example 3D Object (Layer 1)
  async create3DObjects() {
    // Container for the head tracking (Anchor at forehead)
    this.headAnchor = new THREE.Group();
    this.headAnchor.layers.set(1);
    this.scene.add(this.headAnchor);

    // Download all start screen images
    const [startScreenImg, thankYouImg, revealImg] = await Promise.all([
      download_image("start_screen/1024__8bit__On_a_scale_from_1_to_10.png"),
      download_image("start_screen/1024__8bit__Thank_you_for_your_input.png"),
      download_image(
        "start_screen/1024__8bit__Anime__Reveal_Global_Average.png",
      ),
    ]);

    // Start screen texture
    const startTex = new THREE.Texture(startScreenImg);
    startTex.colorSpace = THREE.SRGBColorSpace;
    startTex.needsUpdate = true;
    this.startScreen = startTex;

    // Thank you texture
    const thankYouTex = new THREE.Texture(thankYouImg);
    thankYouTex.colorSpace = THREE.SRGBColorSpace;
    thankYouTex.needsUpdate = true;
    this.thankYouScreen = thankYouTex;

    // Reveal global average texture
    const revealTex = new THREE.Texture(revealImg);
    revealTex.colorSpace = THREE.SRGBColorSpace;
    revealTex.needsUpdate = true;
    this.revealScreen = revealTex;

    // Background Plane (Color, Opacity)
    const bgGeo = new THREE.PlaneGeometry(5, 5);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false, // Prevents z-fighting
    });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 5, 0);
    this.bgMesh.renderOrder = -1;
    this.bgMesh.layers.set(1);
    this.headAnchor.add(this.bgMesh);

    const geo = new THREE.PlaneGeometry(5, 5);
    this.textureMap = new THREE.MeshBasicMaterial({
      map: startTex,
      transparent: true,
    });

    this.box3D = new THREE.Mesh(geo, this.textureMap);

    // Offset relative to forehead (Anchor)
    // Moves the plane UP relative to the head orientation
    this.box3D.position.set(0, 5, 0);
    this.box3D.renderOrder = 0;

    this.box3D.layers.set(1);
    this.headAnchor.add(this.box3D);

    // Text Label (wider than image plane to fit longer names)
    const labelGeo = new THREE.PlaneGeometry(10, 1.25);
    const labelMat = new THREE.MeshBasicMaterial({
      map: this.createLabelTexture(""),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.textMesh = new THREE.Mesh(labelGeo, labelMat);
    this.textMesh.position.set(0, 7.9, 0); // Text distance to box3D – 10 more far
    this.textMesh.renderOrder = 1; // Render after box3D
    this.textMesh.layers.set(1);
    this.headAnchor.add(this.textMesh);
  }

  // RESPONSIVE
  checkResize() {
    if (window.visualViewport && window.visualViewport.scale > 1.01) {
      return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const vw = this.video_stream.videoWidth;
    const vh = this.video_stream.videoHeight;

    // Check if window size OR video size has changed
    if (
      w !== this._lastW ||
      h !== this._lastH ||
      vw !== this._lastVW ||
      vh !== this._lastVH
    ) {
      this._lastW = w;
      this._lastH = h;
      this._lastVW = vw;
      this._lastVH = vh;

      this.renderer.setSize(w, h);

      // ORTHO CAM UPDATES
      this.orthoCam.left = -w / 2;
      this.orthoCam.right = w / 2;
      this.orthoCam.top = h / 2;
      this.orthoCam.bottom = -h / 2;
      this.orthoCam.updateProjectionMatrix();

      // PERSPECTIVE CAM UPDATES
      this.perspCam.aspect = w / h;
      this.perspCam.updateProjectionMatrix();

      this.updateVideoScale();
    }
  }

  // Check if face bounding box is visible in the viewport
  isFaceInViewport(face) {
    if (!face || !face.box) return false;

    const box = face.box;
    const vw = this.video_stream.videoWidth;
    const vh = this.video_stream.videoHeight;

    if (!vw || !vh || !this._videoScaledW) return false;

    const faceCenterX = box.xMin + box.width / 2;
    const faceCenterY = box.yMin + box.height / 2;

    // Convert to canvas pixel coords
    const canvasPos = this.videoPixelToCanvasPixel(faceCenterX, faceCenterY);

    // Check if face center is within the visible screen area
    const margin = 0;
    const inViewport =
      canvasPos.x >= -margin &&
      canvasPos.x <= this._screenW + margin &&
      canvasPos.y >= -margin &&
      canvasPos.y <= this._screenH + margin;

    return inViewport;
  }

  // map video pixel coords (px,py) -> canvas pixel coords
  videoPixelToCanvasPixel(px, py) {
    const vw = this.video_stream.videoWidth;
    const vh = this.video_stream.videoHeight;
    if (!vw || !vh || !this._videoScaledW) return { x: 0, y: 0 };

    // px proportion within video
    const nx = px / vw;
    const ny = py / vh;

    // canvas position (top-left origin)
    const cx = this._videoLeft + nx * this._videoScaledW;
    const cy = this._videoTop + ny * this._videoScaledH;

    return { x: cx, y: cy };
  }

  // map canvas pixel -> world point along camera ray, at a given distance from camera
  screenPixelToWorldAtDistance(canvasX, canvasY, camera) {
    // NDC
    const ndc = new THREE.Vector3(
      (canvasX / this.renderer.domElement.clientWidth) * 2 - 1,
      -(canvasY / this.renderer.domElement.clientHeight) * 2 + 1,
      -1,
    );

    // point on near-mid plane in world coords
    const worldPoint = ndc.unproject(camera);

    return worldPoint;
  }

  screenToWorldAtZ(canvasX, canvasY, camera, targetZ) {
    const mouse = new THREE.Vector2(
      (canvasX / this.renderer.domElement.clientWidth) * 2 - 1,
      -(canvasY / this.renderer.domElement.clientHeight) * 2 + 1,
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
    return videoWidth / 2 / Math.tan((fovDeg * Math.PI) / 180 / 2);
  }

  // Distance between eyes in pixels (FaceMesh Keypoints)
  getEyePixelDistance(f) {
    // FaceMesh landmarks:
    // 33 = left eye outer corner
    // 263 = right eye outer corner

    const L = f.keypoints[33];
    const R = f.keypoints[263];

    const dx = L.x - R.x;
    const dy = L.y - R.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // Main function: computes depth in meters
  computeRealDepthFromEyes(f, yaw = 0) {
    const vw = this.video_stream.videoWidth;
    const vh = this.video_stream.videoHeight;
    const fov = 65; // typical Webcam-FOV (Short Side)

    // Use short side for consistent focal length (sensor vertical FOV)
    const shortSide = Math.min(vw, vh);
    const f_px = this.getFocalLengthPixels(shortSide, fov);

    const eyePx = this.getEyePixelDistance(f);

    if (eyePx < 1) return null;

    // Correct for head rotation (Yaw)
    // When head turns, projected eye distance shrinks by cos(yaw).
    // We want the "frontal" distance to estimate true depth.
    // Limit yaw to avoid division by zero or extreme values (e.g. max 60 degrees)
    const maxAngle = 60 * (Math.PI / 180);
    const clampedYaw = Math.max(-maxAngle, Math.min(maxAngle, yaw));
    const correctionFactor = Math.cos(clampedYaw);

    // Avoid division by zero if cos is too small (shouldn't happen with clamp)
    const correctedEyePx = eyePx / Math.max(0.1, correctionFactor);

    // Perspective depth formula
    const distanceMeters = (REAL_IPD * f_px) / correctedEyePx;

    return distanceMeters;
  } // Optional: map real meters to your desired scene Z-depth
  mapDepthMetersToSceneZ(m) {
    // Your camera is at z = 50 → map meters logically
    // m = 0.5m → close, m = 1.5m → far
    return THREE.MathUtils.mapLinear(m, 0.4, 1.2, 20, -30);
  }

  createLabelTexture(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 2048; // Wider canvas to match 10:1.25 plane ratio (8:1)
    canvas.height = 256;

    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (text) {
      // Truncate text to 25 characters and add "..." if longer
      const maxLength = 25;
      const displayText =
        text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

      const fontSize = 100;
      ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "dimgrey";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  // ANIMATE
  async animate(time) {
    this.checkResize();

    this.renderer.autoClear = false;
    this.renderer.clear();

    // Face Mesh
    if (
      this.detector &&
      this.video_stream.readyState >= 2 &&
      this.video_stream.videoWidth > 0 &&
      this.video_stream.videoHeight > 0
    ) {
      const options = { maxFaces: 1, flipHorizontal: true };
      try {
        this.face = await this.detector.estimateFaces(
          this.video_stream,
          options,
        );
      } catch (error) {
        // console.warn("Face detection skipped:", error);
      }
    }

    const faceFound = this.face && this.face.length > 0;
    const faceInViewport = faceFound && this.isFaceInViewport(this.face[0]);

    if (faceInViewport) {
      this.lastFaceDetectedTime = time;
      this.detectorStaleTimeout = null;
      if (this.headAnchor) this.headAnchor.visible = true;
    } else {
      // Prevent flickering: Keep showing for 200ms after loss
      if (time - this.lastFaceDetectedTime > 200) {
        if (this.headAnchor) this.headAnchor.visible = false;
      }

      // Reinitialize detector after 30s without face (prevents stale detector)
      if (
        time - this.lastFaceDetectedTime > 30000 &&
        !this.detectorStaleTimeout
      ) {
        this.detectorStaleTimeout = true;
        const oldDetector = this.detector;
        faceLandmarksDetection
          .createDetector(this.detectorModel, this.detectorConfig)
          .then((d) => {
            this.detector = d;
            if (oldDetector && oldDetector.dispose) {
              try {
                oldDetector.dispose();
              } catch (e) {}
            }
          })
          .catch(() => {});
      }

      //reset game
      if (
        time - this.lastFaceDetectedTime > this.resetTimeout &&
        this.game.state != GAME_STATE.STARTED
      ) {
        if (this.game.state == GAME_STATE.SELECT_IMAGE) {
          this.lastSelectedImageBeforeReset = this.game.currentImage;
        }
        this.game.reset();
      }
    }

    // Update Bounding Box
    if (faceInViewport) {
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

      // Update 3D Rotation
      const leftEye = f.keypoints.find((e) => e.name === "leftEyebrow");
      const rightEye = f.keypoints.find((e) => e.name === "rightEyebrow");
      const chin = f.keypoints[152];
      const forehead = f.keypoints[10];

      this.first_render = false;

      if (leftEye && rightEye && chin) {
        const rawRotY = rotation(leftEye.z, rightEye.z, leftEye.x, rightEye.x); // Yaw
        const rawRotZ = rotation(leftEye.y, rightEye.y, leftEye.x, rightEye.x); // Roll
        const rawRotX = rotation(
          f.keypoints[152].z,
          f.keypoints[10].z,
          f.keypoints[152].y,
          f.keypoints[10].y,
        ); // Pitch

        // Filter Rotation
        if (this.headAnchor) {
          this.headAnchor.rotation.y = this.filterRotY.filter(time, rawRotY);
          this.headAnchor.rotation.z = this.filterRotZ.filter(time, -rawRotZ);
          this.headAnchor.rotation.x = this.filterRotX.filter(time, rawRotX);
        }

        // Compute world position along perspective camera ray
        const canvas_pixel = this.videoPixelToCanvasPixel(
          forehead.x,
          forehead.y,
        );

        // Depth via Eye Distance
        // Pass rawRotY to correct for head rotation
        const depthMeters = this.computeRealDepthFromEyes(f, rawRotY);

        // map to SCENE-Z
        const headZ = this.mapDepthMetersToSceneZ(depthMeters);

        // Filter Z (Depth)
        const smoothZ = this.filterZ.filter(time, headZ);

        const worldPos = this.screenToWorldAtZ(
          canvas_pixel.x,
          canvas_pixel.y,
          this.perspCam,
          smoothZ,
        );

        // Filter Position (Anchor is at forehead)
        const smoothX = this.filterX.filter(time, worldPos.x);
        const smoothY = this.filterY.filter(time, worldPos.y);
        // Z is already filtered

        // set Anchor Position
        if (this.headAnchor) {
          this.headAnchor.position.set(smoothX, smoothY, smoothZ);
        }
      }
    }

    this.delta += this.clock.getDelta();

    //cap pictures each sec
    if (this.delta > this.animationIntervall) {
      if (this.game.state == GAME_STATE.ROLLING) {
        const nextImage = this.picker.nextImage();

        if (nextImage && nextImage.image) {
          this.game.currentImage = nextImage;

          const tex = new THREE.Texture(this.game.currentImage.image);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;

          this.textureMap.map = tex;
          this.textureMap.needsUpdate = true;

          if (this.textMesh) {
            const name = extractNameFromPath(this.game.currentImage.id);
            this.textMesh.material.map = this.createLabelTexture(name);
            this.textMesh.material.needsUpdate = true;
          }
        }
      }

      this.delta = this.delta % this.animationIntervall;
    }

    //pick the last picture
    if (
      this.game.state == GAME_STATE.SELECT_IMAGE &&
      this.lastSelectedImageBeforeReset
    ) {
      this.game.currentImage = this.lastSelectedImageBeforeReset;
      const tex = new THREE.Texture(this.game.currentImage.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this.textureMap.map = tex;
      this.textureMap.needsUpdate = true;

      if (this.textMesh) {
        const name = extractNameFromPath(this.game.currentImage.id);
        this.textMesh.material.map = this.createLabelTexture(name);
        this.textMesh.material.needsUpdate = true;
      }

      this.lastSelectedImageBeforeReset = null;
    }

    if (
      this.game.state == GAME_STATE.STARTED &&
      this.startScreen &&
      this.textureMap
    ) {
      this.textureMap.map = this.startScreen;
      this.textureMap.needsUpdate = true;

      if (this.textMesh) {
        this.textMesh.material.map = this.createLabelTexture("");
        this.textMesh.material.needsUpdate = true;
      }
    }

    // REVEAL_PAUSE: Display "Thank you for your input"
    if (
      this.game.state == GAME_STATE.REVEAL_PAUSE &&
      this.thankYouScreen &&
      this.textureMap
    ) {
      this.textureMap.map = this.thankYouScreen;
      this.textureMap.needsUpdate = true;

      if (this.textMesh) {
        this.textMesh.material.map = this.createLabelTexture("");
        this.textMesh.material.needsUpdate = true;
      }
    }

    // REVEALING: Display "Reveal Global Average"
    if (
      this.game.state == GAME_STATE.REVEALING &&
      this.revealScreen &&
      this.textureMap
    ) {
      this.textureMap.map = this.revealScreen;
      this.textureMap.needsUpdate = true;

      if (this.textMesh) {
        this.textMesh.material.map = this.createLabelTexture("");
        this.textMesh.material.needsUpdate = true;
      }
    }

    // RENDER PASS 1: Video/UI (Layer 0)
    this.orthoCam.layers.set(0);
    this.renderer.render(this.scene, this.orthoCam);

    this.renderer.clearDepth();

    // RENDER PASS 2: 3D Objects (Layer 1)
    this.perspCam.layers.set(1);
    this.renderer.render(this.scene, this.perspCam);
  }
}
