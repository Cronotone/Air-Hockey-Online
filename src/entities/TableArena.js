import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { CONFIG } from "../config.js";

export function createTableArena() {
  const group = new THREE.Group();
  const halfWidth = CONFIG.table.width * 0.5;
  const halfLength = CONFIG.table.length * 0.5;
  const tabletopTexture = createAirHockeyTopTexture();

  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a455f,
    roughness: 0.56,
    metalness: 0.16,
  });

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.table.width, CONFIG.table.thickness, CONFIG.table.length),
    surfaceMaterial
  );
  table.position.y = CONFIG.table.surfaceY - CONFIG.table.thickness * 0.5;
  table.receiveShadow = true;
  table.castShadow = true;
  group.add(table);

  const tabletop = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.table.width - 0.2, CONFIG.table.length - 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0.22,
      map: tabletopTexture,
    })
  );
  tabletop.rotation.x = -Math.PI * 0.5;
  tabletop.position.y = CONFIG.table.surfaceY + 0.004;
  tabletop.receiveShadow = true;
  group.add(tabletop);

  const centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.table.width - 1.4, CONFIG.table.centerLineWidth),
    new THREE.MeshStandardMaterial({
      color: 0xddeeff,
      roughness: 0.7,
      metalness: 0.05,
    })
  );
  centerLine.rotation.x = -Math.PI * 0.5;
  centerLine.position.y = CONFIG.table.surfaceY + 0.01;
  group.add(centerLine);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4edf9,
    roughness: 0.35,
    metalness: 0.06,
  });

  const wallY = CONFIG.table.surfaceY + CONFIG.table.wallHeight * 0.5;
  const sideWallGeometry = new THREE.BoxGeometry(
    CONFIG.table.wallThickness,
    CONFIG.table.wallHeight,
    CONFIG.table.length + CONFIG.table.wallThickness
  );
  const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.set(-halfWidth, wallY, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  rightWall.position.set(halfWidth, wallY, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const segmentWidth = (CONFIG.table.width - CONFIG.goal.slotWidth) * 0.5;
  const backSegmentGeometry = new THREE.BoxGeometry(
    segmentWidth,
    CONFIG.table.wallHeight,
    CONFIG.table.wallThickness
  );
  const backRightWall = new THREE.Mesh(backSegmentGeometry, wallMaterial);
  backRightWall.castShadow = true;
  backRightWall.receiveShadow = true;
  group.add(backRightWall);

  const backLeftWall = new THREE.Mesh(backSegmentGeometry, wallMaterial);
  backLeftWall.castShadow = true;
  backLeftWall.receiveShadow = true;
  group.add(backLeftWall);

  const frontRightWall = new THREE.Mesh(backSegmentGeometry, wallMaterial);
  frontRightWall.castShadow = true;
  frontRightWall.receiveShadow = true;
  group.add(frontRightWall);

  const frontLeftWall = new THREE.Mesh(backSegmentGeometry, wallMaterial);
  frontLeftWall.castShadow = true;
  frontLeftWall.receiveShadow = true;
  group.add(frontLeftWall);

  const goalPocketGeometry = new THREE.BoxGeometry(CONFIG.goal.slotWidth, CONFIG.table.wallHeight * 0.62, CONFIG.goal.pocketDepth);
  const goalPocketMaterial = new THREE.MeshStandardMaterial({
    color: 0x193553,
    roughness: 0.62,
    metalness: 0.08,
  });

  const goalPocketBack = new THREE.Mesh(goalPocketGeometry, goalPocketMaterial);
  goalPocketBack.position.set(0, CONFIG.table.surfaceY + CONFIG.table.wallHeight * 0.31, halfLength + CONFIG.goal.pocketDepth * 0.5);
  goalPocketBack.castShadow = true;
  goalPocketBack.receiveShadow = true;
  group.add(goalPocketBack);

  const goalPocketFront = new THREE.Mesh(goalPocketGeometry, goalPocketMaterial);
  goalPocketFront.position.set(0, CONFIG.table.surfaceY + CONFIG.table.wallHeight * 0.31, -halfLength - CONFIG.goal.pocketDepth * 0.5);
  goalPocketFront.castShadow = true;
  goalPocketFront.receiveShadow = true;
  group.add(goalPocketFront);

  const legGeometry = new THREE.BoxGeometry(0.5, 2.2, 0.5);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e2a38,
    roughness: 0.42,
    metalness: 0.28,
  });
  const legPositions = [
    [CONFIG.table.width * 0.39, -0.68, CONFIG.table.length * 0.39],
    [-CONFIG.table.width * 0.39, -0.68, CONFIG.table.length * 0.39],
    [CONFIG.table.width * 0.39, -0.68, -CONFIG.table.length * 0.39],
    [-CONFIG.table.width * 0.39, -0.68, -CONFIG.table.length * 0.39],
  ];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  const goalState = {
    playerScale: 1,
    opponentScale: 1,
  };

  function applyGoalVisualsForEnd(rightWall, leftWall, pocket, endZ, scale) {
    const clampedScale = clamp(scale, 0.5, 1);
    const scaledSlotWidth = CONFIG.goal.slotWidth * clampedScale;
    const scaledSegmentWidth = (CONFIG.table.width - scaledSlotWidth) * 0.5;
    const segmentCenterX = (halfWidth + scaledSlotWidth * 0.5) * 0.5;
    const segmentScaleX = scaledSegmentWidth / segmentWidth;

    rightWall.scale.x = segmentScaleX;
    leftWall.scale.x = segmentScaleX;
    rightWall.position.set(segmentCenterX, wallY, endZ);
    leftWall.position.set(-segmentCenterX, wallY, endZ);

    pocket.scale.x = clampedScale;
  }

  function applyGoalVisuals() {
    applyGoalVisualsForEnd(
      backRightWall,
      backLeftWall,
      goalPocketBack,
      halfLength,
      goalState.playerScale
    );
    applyGoalVisualsForEnd(
      frontRightWall,
      frontLeftWall,
      goalPocketFront,
      -halfLength,
      goalState.opponentScale
    );
  }

  group.userData.setGoalScale = (side, scale) => {
    if (side === "player") {
      goalState.playerScale = scale;
    } else if (side === "opponent") {
      goalState.opponentScale = scale;
    }
    applyGoalVisuals();
  };

  group.userData.setGoalScales = (playerScale, opponentScale) => {
    goalState.playerScale = playerScale;
    goalState.opponentScale = opponentScale;
    applyGoalVisuals();
  };

  applyGoalVisuals();

  return group;
}

function createAirHockeyTopTexture() {
  if (typeof document === "undefined") {
    return null;
  }

  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const bgGradient = ctx.createLinearGradient(0, 0, 0, size);
  bgGradient.addColorStop(0, "#f3f8ff");
  bgGradient.addColorStop(1, "#d9e6f8");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.48);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  glow.addColorStop(1, "rgba(167, 194, 229, 0.1)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const holeSpacing = 22;
  const holeRadius = 1.45;
  const margin = 30;
  for (let y = margin; y < size - margin; y += holeSpacing) {
    const staggerOffset = Math.floor((y - margin) / holeSpacing) % 2 === 0 ? 0 : holeSpacing * 0.5;
    for (let x = margin + staggerOffset; x < size - margin; x += holeSpacing) {
      ctx.fillStyle = "rgba(48, 72, 102, 0.28)";
      ctx.beginPath();
      ctx.arc(x, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.arc(x - 0.35, y - 0.35, holeRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(141, 170, 205, 0.35)";
  ctx.lineWidth = size * 0.01;
  ctx.strokeRect(size * 0.03, size * 0.03, size * 0.94, size * 0.94);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  drawCenterLogoOnTexture(canvas, texture);

  return texture;
}

function drawCenterLogoOnTexture(canvas, texture) {
  const paths = [
    "./src/assets/images/Cronotone.jpg",
    "./src/assets/images/cronotone.jpg",
    "./src/assets/images/cronotone-logo.webp",
    "./src/assets/images/cronotone-logo.png",
    "./src/assets/images/cronotone-logo.jpg",
    "./src/assets/images/cronotone-logo.jpeg",
  ];

  const tryLoad = (index) => {
    if (index >= paths.length) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const maxW = canvas.width * 0.96;
      const maxH = canvas.height * 0.92;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const drawX = (canvas.width - drawW) * 0.5;
      const drawY = (canvas.height - drawH) * 0.5;

      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      ctx.restore();

      texture.needsUpdate = true;
    };
    image.onerror = () => {
      tryLoad(index + 1);
    };
    image.src = paths[index];
  };

  tryLoad(0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
