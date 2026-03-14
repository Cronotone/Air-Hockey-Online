import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

const TOP_TEXTURE_CACHE = new Map();

export class Padel {
  constructor({ color, zPosition }) {
    this.baseRadius = CONFIG.paddle.radius;
    this.baseHeight = CONFIG.paddle.height;
    this.radius = this.baseRadius;
    this.height = this.baseHeight;
    this.scaleFactor = 1;
    this.mass = CONFIG.paddle.mass;
    this.velocity = new THREE.Vector3();

    const accentColor = new THREE.Color(color);
    const topTexture = getTopTexture(color);

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x11161c,
      roughness: 0.62,
      metalness: 0.2,
    });
    const rimMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.54,
      emissive: accentColor.clone().multiplyScalar(0.06),
    });
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0xf6f9ff,
      roughness: 0.48,
      metalness: 0.2,
      map: topTexture,
    });
    const glideMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9dee6,
      roughness: 0.26,
      metalness: 0.14,
    });

    this.mesh = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.98, this.radius * 0.92, this.height * 0.62, 48, 1),
      baseMaterial
    );
    base.position.y = -this.height * 0.09;
    setShadow(base);
    this.mesh.add(base);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius, this.radius * 0.96, this.height * 0.36, 56, 1),
      rimMaterial
    );
    rim.position.y = this.height * 0.08;
    setShadow(rim);
    this.mesh.add(rim);

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.72, this.radius * 0.76, this.height * 0.16, 40, 1),
      topMaterial
    );
    topCap.position.y = this.height * 0.21;
    setShadow(topCap);
    this.mesh.add(topCap);

    const topHub = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.28, this.radius * 0.32, this.height * 0.1, 32, 1),
      rimMaterial.clone()
    );
    topHub.position.y = this.height * 0.145;
    setShadow(topHub);
    this.mesh.add(topHub);

    const glide = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.52, this.radius * 0.56, this.height * 0.07, 32, 1),
      glideMaterial
    );
    glide.position.y = -this.height * 0.225;
    setShadow(glide);
    this.mesh.add(glide);

    const accentRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius * 0.74, this.height * 0.04, 14, 64),
      rimMaterial
    );
    accentRing.rotation.x = Math.PI * 0.5;
    accentRing.position.y = this.height * 0.165;
    setShadow(accentRing);
    this.mesh.add(accentRing);

    this.mesh.position.set(0, CONFIG.table.surfaceY + this.height * 0.5, zPosition);
    this.setScaleFactor(1);
  }

  setPosition(x, z) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }

  reset(x, z) {
    this.setPosition(x, z);
    this.mesh.position.y = CONFIG.table.surfaceY + this.height * 0.5;
    this.velocity.set(0, 0, 0);
  }

  setScaleFactor(scaleFactor) {
    const scale = Math.max(0.5, scaleFactor);
    this.scaleFactor = scale;
    this.radius = this.baseRadius * scale;
    this.height = this.baseHeight * scale;
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.position.y = CONFIG.table.surfaceY + this.height * 0.5;
  }
}

function setShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

function getTopTexture(color) {
  if (TOP_TEXTURE_CACHE.has(color)) {
    return TOP_TEXTURE_CACHE.get(color);
  }

  if (typeof document === "undefined") {
    return null;
  }

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const center = size * 0.5;
  const accent = new THREE.Color(color);
  const accentCss = `#${accent.getHexString()}`;

  const bg = ctx.createRadialGradient(center, center, size * 0.1, center, center, size * 0.45);
  bg.addColorStop(0, "#f9fcff");
  bg.addColorStop(1, "#b7c4d8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = accentCss;
  ctx.lineWidth = size * 0.042;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(15, 24, 36, 0.24)";
  ctx.beginPath();
  ctx.arc(center, center, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = size * 0.009;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  for (let i = 0; i < 24; i += 1) {
    const r = size * (0.15 + i * 0.012);
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  TOP_TEXTURE_CACHE.set(color, texture);
  return texture;
}
