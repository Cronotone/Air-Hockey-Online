import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

export const POWERUP_TYPES = {
  sizeBoost: {
    id: "size-boost",
    symbol: "2X",
    label: "Size Boost",
    duration: 8,
  },
  goalShield: {
    id: "goal-shield",
    symbol: "G/2",
    label: "Goal Shield",
    duration: 8,
  },
  blind: {
    id: "blind",
    symbol: "BL",
    label: "Blind",
    duration: 3,
  },
};

const POWERUP_POOL = Object.values(POWERUP_TYPES);

export class PowerupSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.enabled = true;
    this.activePickup = null;
    this.spawnTimer = randomRange(0.15, 0.5);
    this.typeCycle = [
      POWERUP_TYPES.sizeBoost.id,
      POWERUP_TYPES.goalShield.id,
      POWERUP_TYPES.blind.id,
    ];
    this.nextTypeIndex = 0;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.clearPickup();
    }
  }

  reset() {
    this.clearPickup();
    this.spawnTimer = randomRange(0.15, 0.5);
  }

  update(dt, canSpawn, options = {}) {
    if (this.activePickup) {
      this.activePickup.age += dt;
      this.activePickup.mesh.rotation.y += dt * 1.6;
      this.activePickup.mesh.position.y =
        CONFIG.table.surfaceY + 0.12 + Math.sin(this.activePickup.age * 3.3) * 0.04;
    }

    if (!this.enabled || !canSpawn || this.activePickup) {
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) {
      return;
    }

    this.spawnPickup(options);
  }

  collectForDisc(disc, side) {
    if (!this.activePickup) {
      return null;
    }

    const dx = disc.mesh.position.x - this.activePickup.mesh.position.x;
    const dz = disc.mesh.position.z - this.activePickup.mesh.position.z;
    const pickupRadius = this.activePickup.radius;
    const collectDistance = disc.radius + pickupRadius;
    if (dx * dx + dz * dz > collectDistance * collectDistance) {
      return null;
    }

    const result = {
      side,
      type: this.activePickup.type,
    };
    this.clearPickup();
    this.spawnTimer = randomRange(0.15, 0.5);
    return result;
  }

  getActivePickup() {
    if (!this.activePickup) {
      return null;
    }
    return {
      x: this.activePickup.mesh.position.x,
      z: this.activePickup.mesh.position.z,
      radius: this.activePickup.radius,
      type: this.activePickup.type,
    };
  }

  clearPickup() {
    if (!this.activePickup) {
      return;
    }
    this.group.remove(this.activePickup.mesh);
    this.activePickup = null;
  }

  spawnPickup(options = {}) {
    const type = this.getNextType(options);

    const mesh = createPickupMesh(type);
    const radius = 0.38;
    const halfWidth = CONFIG.table.width * 0.5 - CONFIG.table.wallThickness - radius - 1.2;
    const halfLength = CONFIG.table.length * 0.5 - CONFIG.table.wallThickness - radius - 3.2;
    const x = randomRange(-halfWidth, halfWidth);
    let minZ = -halfLength;
    let maxZ = halfLength;
    if (options.preferredSide === "player") {
      minZ = 0.2;
      maxZ = halfLength;
    } else if (options.preferredSide === "opponent") {
      minZ = -halfLength;
      maxZ = -0.2;
    }
    const z = randomRange(minZ, maxZ);
    mesh.position.set(x, CONFIG.table.surfaceY + 0.12, z);

    this.group.add(mesh);
    this.activePickup = {
      type,
      mesh,
      radius,
      age: 0,
    };
  }

  getNextType(options = {}) {
    const allowBlind = options.allowBlind !== false;
    const maxAttempts = this.typeCycle.length;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const index = (this.nextTypeIndex + attempt) % this.typeCycle.length;
      const typeId = this.typeCycle[index];
      const type = POWERUP_POOL.find((item) => item.id === typeId);
      if (!type) {
        continue;
      }
      if (!allowBlind && type.id === POWERUP_TYPES.blind.id) {
        continue;
      }
      this.nextTypeIndex = (index + 1) % this.typeCycle.length;
      return type;
    }

    const fallbackPool = allowBlind
      ? POWERUP_POOL
      : POWERUP_POOL.filter((item) => item.id !== POWERUP_TYPES.blind.id);
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }
}

function createPickupMesh(type) {
  const root = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.34, 0.17, 32, 1),
    new THREE.MeshStandardMaterial({
      color: 0xf7d44f,
      roughness: 0.36,
      metalness: 0.42,
      emissive: 0x433300,
      emissiveIntensity: 0.36,
    })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.06, 30, 1),
    new THREE.MeshStandardMaterial({
      color: 0xfff7cf,
      roughness: 0.28,
      metalness: 0.2,
    })
  );
  top.position.y = 0.1;
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  const symbol = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createSymbolTexture(type.symbol),
      transparent: true,
      depthWrite: false,
    })
  );
  symbol.scale.set(0.56, 0.56, 1);
  symbol.position.y = 0.27;
  root.add(symbol);

  return root;
}

function createSymbolTexture(text) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255, 247, 190, 0.96)";
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(20, 20, 20, 0.95)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#101521";
  ctx.font = "700 42px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size * 0.5, size * 0.52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
