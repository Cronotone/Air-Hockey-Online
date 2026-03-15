import { CONFIG } from "../config.js";

const EPSILON = 1e-6;

export function getDiscBounds(side, radius) {
  const limits = getCenterLimits(radius);

  if (side === "player") {
    return {
      minX: -limits.x,
      maxX: limits.x,
      minZ: radius + 0.02,
      maxZ: limits.z,
    };
  }

  return {
    minX: -limits.x,
    maxX: limits.x,
    minZ: -limits.z,
    maxZ: -radius - 0.02,
  };
}

export function moveDiscTowardTarget(disc, targetX, targetZ, dt, controlConfig, bounds) {
  const clampedTargetX = clamp(targetX, bounds.minX, bounds.maxX);
  const clampedTargetZ = clamp(targetZ, bounds.minZ, bounds.maxZ);

  const dx = clampedTargetX - disc.mesh.position.x;
  const dz = clampedTargetZ - disc.mesh.position.z;
  const distance = Math.hypot(dx, dz);

  let desiredVx = 0;
  let desiredVz = 0;
  if (distance > EPSILON) {
    const rawDesiredSpeed = distance / Math.max(dt, EPSILON);
    const desiredSpeed =
      typeof controlConfig.maxSpeed === "number"
        ? Math.min(controlConfig.maxSpeed, rawDesiredSpeed)
        : rawDesiredSpeed;
    desiredVx = (dx / distance) * desiredSpeed;
    desiredVz = (dz / distance) * desiredSpeed;
  }

  let deltaVx = desiredVx - disc.velocity.x;
  let deltaVz = desiredVz - disc.velocity.z;
  const deltaMag = Math.hypot(deltaVx, deltaVz);
  const maxDelta = controlConfig.acceleration * dt;
  if (deltaMag > maxDelta && deltaMag > EPSILON) {
    const scale = maxDelta / deltaMag;
    deltaVx *= scale;
    deltaVz *= scale;
  }

  disc.velocity.x += deltaVx;
  disc.velocity.z += deltaVz;

  const damping = Math.pow(controlConfig.linearDamping, dt * 60);
  disc.velocity.x *= damping;
  disc.velocity.z *= damping;
  if (typeof controlConfig.maxSpeed === "number") {
    const discSpeed = Math.hypot(disc.velocity.x, disc.velocity.z);
    if (discSpeed > controlConfig.maxSpeed) {
      const scale = controlConfig.maxSpeed / discSpeed;
      disc.velocity.x *= scale;
      disc.velocity.z *= scale;
    }
  }

  disc.mesh.position.x += disc.velocity.x * dt;
  disc.mesh.position.z += disc.velocity.z * dt;

  clampDiscToBounds(disc, bounds);
}

export function enforceDiscBounds(disc, bounds) {
  clampDiscToBounds(disc, bounds);
}

export function updatePuckPhysics(puck, playerDisc, opponentDisc, dt, events = null, options = null) {
  puck.advance(dt);

  const puckLimits = getCenterLimits(puck.radius);
  // Two passes helps avoid persistent overlap when collisions happen near walls/corners.
  resolveDiscPuckCollision(playerDisc, puck, "player", events);
  resolveDiscPuckCollision(opponentDisc, puck, "opponent", events);
  resolveDiscPuckCollision(playerDisc, puck, "player", events);
  resolveDiscPuckCollision(opponentDisc, puck, "opponent", events);

  const puckDamping = Math.pow(CONFIG.ball.linearDamping, dt * 60);
  puck.velocity.x *= puckDamping;
  puck.velocity.z *= puckDamping;
  if (typeof CONFIG.ball.maxSpeed === "number") {
    const speed = Math.hypot(puck.velocity.x, puck.velocity.z);
    if (speed > CONFIG.ball.maxSpeed) {
      const scale = CONFIG.ball.maxSpeed / speed;
      puck.velocity.x *= scale;
      puck.velocity.z *= scale;
    }
  }

  if (puck.mesh.position.x >= puckLimits.x && puck.velocity.x > 0) {
    const impactSpeed = Math.abs(puck.velocity.x);
    puck.mesh.position.x = puckLimits.x;
    puck.velocity.x = -Math.abs(puck.velocity.x) * CONFIG.ball.wallRestitution;
    if (events && typeof events.onWallHit === "function") {
      events.onWallHit(impactSpeed);
    }
  } else if (puck.mesh.position.x <= -puckLimits.x && puck.velocity.x < 0) {
    const impactSpeed = Math.abs(puck.velocity.x);
    puck.mesh.position.x = -puckLimits.x;
    puck.velocity.x = Math.abs(puck.velocity.x) * CONFIG.ball.wallRestitution;
    if (events && typeof events.onWallHit === "function") {
      events.onWallHit(impactSpeed);
    }
  }

  const playerGoalScale =
    options && typeof options.playerGoalScale === "number" ? options.playerGoalScale : 1;
  const opponentGoalScale =
    options && typeof options.opponentGoalScale === "number" ? options.opponentGoalScale : 1;
  const playerGoalHalfWidth = Math.max(0.2, CONFIG.goal.slotWidth * 0.5 * playerGoalScale - puck.radius);
  const opponentGoalHalfWidth = Math.max(0.2, CONFIG.goal.slotWidth * 0.5 * opponentGoalScale - puck.radius);
  const scoreDepthFactor =
    typeof CONFIG.goal.scoreDepthFactor === "number" ? CONFIG.goal.scoreDepthFactor : 0.5;
  const scoreDepth = puck.radius * scoreDepthFactor;
  const positiveGoalScoreZ = puckLimits.z + scoreDepth;
  const negativeGoalScoreZ = -puckLimits.z - scoreDepth;

  if (puck.mesh.position.z >= puckLimits.z) {
    if (Math.abs(puck.mesh.position.x) <= playerGoalHalfWidth) {
      if (puck.mesh.position.z >= positiveGoalScoreZ) {
        return "opponent";
      }
      // Inside goal mouth but not deep enough to score yet.
      return null;
    }
    const impactSpeed = Math.abs(puck.velocity.z);
    puck.mesh.position.z = puckLimits.z;
    puck.velocity.z = -Math.abs(puck.velocity.z) * CONFIG.ball.wallRestitution;
    if (events && typeof events.onWallHit === "function") {
      events.onWallHit(impactSpeed);
    }
  } else if (puck.mesh.position.z <= -puckLimits.z) {
    if (Math.abs(puck.mesh.position.x) <= opponentGoalHalfWidth) {
      if (puck.mesh.position.z <= negativeGoalScoreZ) {
        return "player";
      }
      // Inside goal mouth but not deep enough to score yet.
      return null;
    }
    const impactSpeed = Math.abs(puck.velocity.z);
    puck.mesh.position.z = -puckLimits.z;
    puck.velocity.z = Math.abs(puck.velocity.z) * CONFIG.ball.wallRestitution;
    if (events && typeof events.onWallHit === "function") {
      events.onWallHit(impactSpeed);
    }
  }

  maybeApplyCornerEscapeImpulse(puck, puckLimits);

  return null;
}

function resolveDiscPuckCollision(disc, puck, side, events) {
  const dx = puck.mesh.position.x - disc.mesh.position.x;
  const dz = puck.mesh.position.z - disc.mesh.position.z;
  let distance = Math.hypot(dx, dz);
  const minDistance = disc.radius + puck.radius;

  if (distance >= minDistance) {
    return;
  }

  let nx = 0;
  let nz = 0;
  if (distance < EPSILON) {
    const rvx = puck.velocity.x - disc.velocity.x;
    const rvz = puck.velocity.z - disc.velocity.z;
    const rvLen = Math.hypot(rvx, rvz);
    if (rvLen > EPSILON) {
      nx = rvx / rvLen;
      nz = rvz / rvLen;
    } else {
      const towardCenterX = -puck.mesh.position.x;
      const towardCenterZ = -puck.mesh.position.z;
      const centerLen = Math.hypot(towardCenterX, towardCenterZ) || 1;
      nx = towardCenterX / centerLen;
      nz = towardCenterZ / centerLen;
    }
    distance = EPSILON;
  } else {
    nx = dx / distance;
    nz = dz / distance;
  }
  const overlap = minDistance - distance;

  const totalInverseMass = 1 / disc.mass + 1 / puck.mass;
  disc.mesh.position.x -= nx * overlap * ((1 / disc.mass) / totalInverseMass);
  disc.mesh.position.z -= nz * overlap * ((1 / disc.mass) / totalInverseMass);
  puck.mesh.position.x += nx * overlap * ((1 / puck.mass) / totalInverseMass);
  puck.mesh.position.z += nz * overlap * ((1 / puck.mass) / totalInverseMass);

  const relativeVelocityX = puck.velocity.x - disc.velocity.x;
  const relativeVelocityZ = puck.velocity.z - disc.velocity.z;
  const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityZ * nz;

  if (velocityAlongNormal > 0) {
    return;
  }

  const impulseMagnitude =
    (-(1 + CONFIG.ball.discRestitution) * velocityAlongNormal) / totalInverseMass;
  const impulseX = impulseMagnitude * nx;
  const impulseZ = impulseMagnitude * nz;

  disc.velocity.x -= impulseX / disc.mass;
  disc.velocity.z -= impulseZ / disc.mass;
  puck.velocity.x += impulseX / puck.mass;
  puck.velocity.z += impulseZ / puck.mass;

  if (events && typeof events.onDiscHit === "function") {
    events.onDiscHit(side, impulseMagnitude);
  }
}

function clampDiscToBounds(disc, bounds) {
  if (disc.mesh.position.x < bounds.minX) {
    disc.mesh.position.x = bounds.minX;
    disc.velocity.x = 0;
  } else if (disc.mesh.position.x > bounds.maxX) {
    disc.mesh.position.x = bounds.maxX;
    disc.velocity.x = 0;
  }

  if (disc.mesh.position.z < bounds.minZ) {
    disc.mesh.position.z = bounds.minZ;
    disc.velocity.z = 0;
  } else if (disc.mesh.position.z > bounds.maxZ) {
    disc.mesh.position.z = bounds.maxZ;
    disc.velocity.z = 0;
  }
}

function getCenterLimits(radius) {
  const wallInset = CONFIG.table.wallThickness * 0.5;
  return {
    x: CONFIG.table.width * 0.5 - wallInset - radius,
    z: CONFIG.table.length * 0.5 - wallInset - radius,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function maybeApplyCornerEscapeImpulse(puck, puckLimits) {
  const speed = Math.hypot(puck.velocity.x, puck.velocity.z);
  if (speed > CONFIG.ball.stuckSpeedThreshold) {
    return;
  }

  const nearSideWall =
    Math.abs(puck.mesh.position.x) > puckLimits.x - CONFIG.ball.cornerEscapeThreshold;
  const nearBackOrFrontWall =
    Math.abs(puck.mesh.position.z) > puckLimits.z - CONFIG.ball.cornerEscapeThreshold;
  if (!nearSideWall || !nearBackOrFrontWall) {
    return;
  }

  const toCenterX = -puck.mesh.position.x;
  const toCenterZ = -puck.mesh.position.z;
  const length = Math.hypot(toCenterX, toCenterZ) || 1;
  puck.velocity.x = (toCenterX / length) * CONFIG.ball.cornerEscapeSpeed;
  puck.velocity.z = (toCenterZ / length) * CONFIG.ball.cornerEscapeSpeed;
}
