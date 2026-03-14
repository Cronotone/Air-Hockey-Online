import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

export function createSceneSetup(container) {
  if (!container) {
    throw new Error("Missing #app container.");
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.render.clearColor);
  scene.fog = new THREE.Fog(0x070e17, 38, 130);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.replaceChildren(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xbddcff, 0x1a2430, 0.74);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(9, 16, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 90;
  keyLight.shadow.camera.left = -36;
  keyLight.shadow.camera.right = 36;
  keyLight.shadow.camera.top = 36;
  keyLight.shadow.camera.bottom = -36;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7fb4ff, 0.34);
  fillLight.position.set(-10, 8, -16);
  scene.add(fillLight);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", onResize);

  return {
    THREE,
    scene,
    camera,
    renderer,
    dispose() {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}
