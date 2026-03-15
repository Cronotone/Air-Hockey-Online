import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

export class Ball {
  constructor() {
    this.radius = CONFIG.ball.radius;
    this.height = CONFIG.ball.height;
    this.mass = CONFIG.ball.mass;
    this.velocity = new THREE.Vector3();

    const geometry = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 36, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x171d27,
      roughness: 0.38,
      metalness: 0.22,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.resetPosition();
  }

  resetPosition() {
    this.mesh.position.set(0, CONFIG.table.surfaceY + this.height * 0.5 + 0.02, 0);
    this.velocity.set(0, 0, 0);
  }

  serve(direction) {
    const randomAngle = (Math.random() * 2 - 1) * CONFIG.ball.serveAngleMax;
    this.velocity
      .set(Math.sin(randomAngle), 0, Math.cos(randomAngle) * direction)
      .setLength(CONFIG.ball.serveSpeed);
  }

  advance(dt) {
    this.mesh.position.addScaledVector(this.velocity, dt);
  }
}
