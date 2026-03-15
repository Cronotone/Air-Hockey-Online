import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

export class ConfettiSystem {
  constructor(scene, maxParticles = 650) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.activeCount = 0;
    this.gravity = 16;

    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.life = new Float32Array(maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.PointsMaterial({
      size: 0.17,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  triggerGoalBurst(scoringSide) {
    const halfLength = CONFIG.table.length * 0.5;
    const emitterHeight = CONFIG.table.surfaceY + 0.95;
    const zBehind = halfLength + CONFIG.goal.pocketDepth + 0.9;
    const emitters = [
      new THREE.Vector3(0, emitterHeight, zBehind),
      new THREE.Vector3(0, emitterHeight, -zBehind),
    ];

    const colorPool =
      scoringSide === "player"
        ? [0x35d0ff, 0x91e8ff, 0xffffff]
        : [0xff5959, 0xff9a5a, 0xffffff];

    for (const emitter of emitters) {
      this.spawnFromEmitter(emitter, colorPool, 110);
    }
  }

  update(dt) {
    if (this.activeCount === 0) {
      return;
    }

    let i = 0;
    while (i < this.activeCount) {
      const idx3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.swapWithLast(i);
        continue;
      }

      this.velocities[idx3 + 1] -= this.gravity * dt;
      this.positions[idx3] += this.velocities[idx3] * dt;
      this.positions[idx3 + 1] += this.velocities[idx3 + 1] * dt;
      this.positions[idx3 + 2] += this.velocities[idx3 + 2] * dt;
      i += 1;
    }

    this.geometry.setDrawRange(0, this.activeCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  spawnFromEmitter(emitter, colorPool, count) {
    for (let i = 0; i < count; i += 1) {
      if (this.activeCount >= this.maxParticles) {
        break;
      }

      const index = this.activeCount;
      const idx3 = index * 3;
      this.activeCount += 1;

      this.positions[idx3] = emitter.x + (Math.random() - 0.5) * 0.42;
      this.positions[idx3 + 1] = emitter.y + (Math.random() - 0.5) * 0.2;
      this.positions[idx3 + 2] = emitter.z + (Math.random() - 0.5) * 0.42;

      const zDirection = emitter.z > 0 ? -1 : 1;
      this.velocities[idx3] = (Math.random() - 0.5) * 8.4;
      this.velocities[idx3 + 1] = 10 + Math.random() * 8.6;
      this.velocities[idx3 + 2] = zDirection * (6 + Math.random() * 8.2);

      const colorHex = colorPool[Math.floor(Math.random() * colorPool.length)];
      const color = new THREE.Color(colorHex);
      this.colors[idx3] = color.r;
      this.colors[idx3 + 1] = color.g;
      this.colors[idx3 + 2] = color.b;

      this.life[index] = 1.2 + Math.random() * 1.2;
    }
  }

  swapWithLast(index) {
    const last = this.activeCount - 1;
    if (index !== last) {
      const i3 = index * 3;
      const l3 = last * 3;

      this.positions[i3] = this.positions[l3];
      this.positions[i3 + 1] = this.positions[l3 + 1];
      this.positions[i3 + 2] = this.positions[l3 + 2];

      this.velocities[i3] = this.velocities[l3];
      this.velocities[i3 + 1] = this.velocities[l3 + 1];
      this.velocities[i3 + 2] = this.velocities[l3 + 2];

      this.colors[i3] = this.colors[l3];
      this.colors[i3 + 1] = this.colors[l3 + 1];
      this.colors[i3 + 2] = this.colors[l3 + 2];

      this.life[index] = this.life[last];
    }

    this.activeCount -= 1;
  }
}
