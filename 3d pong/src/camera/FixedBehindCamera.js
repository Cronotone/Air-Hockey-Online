import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

const desiredPosition = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

export class FixedBehindCamera {
  constructor() {
    this.offset = new THREE.Vector3(CONFIG.camera.offset.x, CONFIG.camera.offset.y, CONFIG.camera.offset.z);
  }

  update(camera, playerPadel, ball, dt) {
    desiredPosition.set(
      playerPadel.mesh.position.x + this.offset.x,
      CONFIG.table.surfaceY + this.offset.y,
      playerPadel.mesh.position.z + this.offset.z
    );

    const interpolation = 1 - Math.pow(1 - CONFIG.camera.smoothness, dt * 60);
    camera.position.lerp(desiredPosition, interpolation);

    lookTarget.set(
      (playerPadel.mesh.position.x + ball.mesh.position.x) * 0.5,
      CONFIG.table.surfaceY + 0.3,
      playerPadel.mesh.position.z - CONFIG.camera.lookAhead
    );
    camera.lookAt(lookTarget);
  }
}
