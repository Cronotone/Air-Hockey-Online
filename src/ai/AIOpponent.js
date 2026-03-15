import { CONFIG } from "../config.js";

const EPSILON = 1e-6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function reflectCoordinate(value, limit) {
  if (limit <= EPSILON) {
    return 0;
  }
  const period = limit * 4;
  let mapped = ((value + limit) % period + period) % period;
  if (mapped <= limit * 2) {
    return -limit + mapped;
  }
  return limit * 3 - mapped;
}

function predictPuckXAfterTime(x, vx, time, maxX) {
  return reflectCoordinate(x + vx * Math.max(0, time), maxX);
}

export class AIOpponent {
  constructor({ side = "opponent", skill = "standard" } = {}) {
    this.side = side === "player" ? "player" : "opponent";
    this.zMirror = this.side === "player" ? -1 : 1;
    this.skill = skill === "pro" ? "pro" : "standard";
    this.laneBias = randomRange(-1, 1);
    this.pressureTimer = 0;
    this.lastTargetX = 0;
    this.lastTargetZ = 0;
    this.blindTimer = 0;
    this.guessX = 0;
    this.guessZ = 0;
    this.guessVx = 0;
    this.guessVz = 0;
    this.guessJitterTimer = 0;
  }

  setSkill(skill) {
    this.skill = skill === "pro" ? "pro" : "standard";
  }

  reset() {
    this.laneBias = randomRange(-1, 1);
    this.pressureTimer = 0;
    this.lastTargetX = 0;
    this.lastTargetZ = 0;
    this.blindTimer = 0;
    this.guessX = 0;
    this.guessZ = 0;
    this.guessVx = 0;
    this.guessVz = 0;
    this.guessJitterTimer = 0;
  }

  setBlind(seconds) {
    this.blindTimer = Math.max(0, seconds);
    this.guessJitterTimer = 0;
  }

  noteHit(puckVelocity) {
    const localVz = puckVelocity.z * this.zMirror;
    const localVx = puckVelocity.x;
    const rewardWeight = CONFIG.paddle.aiHitReward;
    const penaltyWeight = CONFIG.paddle.aiHitPenalty;

    if (localVz > 1.6) {
      const desiredBias = localVx >= 0 ? 1 : -1;
      this.laneBias += (desiredBias - this.laneBias) * rewardWeight * 1.15;
    } else if (localVz < -0.6) {
      this.laneBias *= 1 - penaltyWeight * 0.25;
    }
    this.laneBias = clamp(this.laneBias, -1, 1);
  }

  chooseGoalAimX(puckX, goalHalfWidth) {
    const laneBiasWeight = this.skill === "pro" ? 0.62 : 0.45;
    const cornerPush = Math.abs(puckX) < 1 ? this.laneBias : -Math.sign(puckX || this.laneBias || 1);
    return clamp(cornerPush * goalHalfWidth * laneBiasWeight, -goalHalfWidth, goalHalfWidth);
  }

  buildShotTarget(selfDisc, puckX, puckZ, maxX, maxZ, minZ, behavior = null) {
    const forwardOnly = !!(behavior && behavior.forwardOnly);
    const goalHalfWidth = CONFIG.goal.slotWidth * 0.5 - CONFIG.ball.radius - 0.12;
    const aimGoalX = this.chooseGoalAimX(puckX, goalHalfWidth);
    const conservativeGoalZ = maxZ + CONFIG.ball.radius + 0.34;
    const forwardGoalZ = Math.abs(minZ) - CONFIG.ball.radius - 0.32;
    const goalZ = forwardOnly ? forwardGoalZ : conservativeGoalZ;

    let shotDirX = aimGoalX - puckX;
    let shotDirZ = goalZ - puckZ;
    const shotLength = Math.hypot(shotDirX, shotDirZ) || 1;
    shotDirX /= shotLength;
    shotDirZ /= shotLength;
    if (forwardOnly) {
      shotDirZ = Math.max(0.22, shotDirZ);
      const renorm = Math.hypot(shotDirX, shotDirZ) || 1;
      shotDirX /= renorm;
      shotDirZ /= renorm;
    }

    const contactDistance = selfDisc.radius + CONFIG.ball.radius - 0.04;
    const contactX = puckX - shotDirX * contactDistance;
    const contactZ = forwardOnly
      ? Math.min(puckZ - 0.14, puckZ - shotDirZ * contactDistance)
      : puckZ - shotDirZ * contactDistance;

    const driveDistance = this.skill === "pro" ? 1.55 : 1.2;
    const driveX = puckX + shotDirX * driveDistance;
    const driveZ = puckZ + shotDirZ * driveDistance;

    const discX = selfDisc.mesh.position.x;
    const discZ = selfDisc.mesh.position.z * this.zMirror;
    const alignedBehind = discZ < puckZ - (forwardOnly ? 0.34 : 0.22) && Math.abs(discX - contactX) < 1.65;

    const targetZ = alignedBehind ? driveZ : contactZ;

    return {
      x: clamp(alignedBehind ? driveX : contactX, -maxX, maxX),
      z: forwardOnly ? Math.min(targetZ, puckZ - 0.08) : targetZ,
    };
  }

  getTarget(selfDisc, puck, dt, behavior = null) {
    const deepDefense = !!(behavior && behavior.deepDefense);
    const forwardOnly = !!(behavior && behavior.forwardOnly);
    this.blindTimer = Math.max(0, this.blindTimer - dt);
    const localDiscX = selfDisc.mesh.position.x;
    const localDiscZ = selfDisc.mesh.position.z * this.zMirror;
    let localPuckX = puck.mesh.position.x;
    let localPuckZ = puck.mesh.position.z * this.zMirror;
    let localPuckVx = puck.velocity.x;
    let localPuckVz = puck.velocity.z * this.zMirror;

    if (this.blindTimer > 0) {
      this.guessJitterTimer -= dt;
      this.guessX += this.guessVx * dt;
      this.guessZ += this.guessVz * dt;
      this.guessVx *= Math.pow(0.98, dt * 60);
      this.guessVz *= Math.pow(0.98, dt * 60);

      if (this.guessJitterTimer <= 0) {
        this.guessJitterTimer = randomRange(0.14, 0.34);
        this.guessVx += randomRange(-7.6, 7.6);
        this.guessVz += randomRange(-6.2, 6.2);
      }

      localPuckX = this.guessX;
      localPuckZ = this.guessZ;
      localPuckVx = this.guessVx;
      localPuckVz = this.guessVz;
    } else {
      this.guessX = localPuckX;
      this.guessZ = localPuckZ;
      this.guessVx = localPuckVx;
      this.guessVz = localPuckVz;
    }
    const puckSpeed = Math.hypot(localPuckVx, localPuckVz);

    this.laneBias *= Math.max(0, 1 - CONFIG.paddle.aiRewardDecayPerSecond * dt);

    const halfTableWidth = CONFIG.table.width * 0.5;
    const halfTableLength = CONFIG.table.length * 0.5;
    const wallInset = CONFIG.table.wallThickness * 0.5;
    const maxX = halfTableWidth - wallInset - selfDisc.radius;
    const minZ = -halfTableLength + wallInset + selfDisc.radius;
    const maxZ = -selfDisc.radius - 0.02;

    const dangerZ = minZ + CONFIG.paddle.aiDangerZoneDepth;
    const interceptZ = this.skill === "pro"
      ? deepDefense ? -6.35 : -5.15
      : deepDefense ? -7.05 : -5.9;
    const defendZ = this.skill === "pro"
      ? deepDefense ? -8.35 : -6.45
      : deepDefense ? -9.15 : -7.25;
    const pressureDecay = this.skill === "pro" ? 1.06 : 1.12;
    const engageBuffer = this.skill === "pro"
      ? deepDefense ? -2.35 : -1.25
      : deepDefense ? -2.9 : -1.9;

    this.pressureTimer = Math.max(0, this.pressureTimer - dt * pressureDecay);

    const nearSideWall = Math.abs(localPuckX) > maxX - 0.52;
    const nearBackWall = localPuckZ < minZ + 0.68;
    const inCornerTrap = nearSideWall && nearBackWall;
    const incomingThreat = localPuckVz < -0.42;
    const ownHalfPuck = localPuckZ < engageBuffer;
    const isDanger = localPuckZ < dangerZ;

    let targetX;
    let targetZ;

    if (isDanger) {
      this.pressureTimer = CONFIG.paddle.aiPressureTime;
      if (inCornerTrap) {
        const wallSign = Math.sign(localPuckX) || 1;
        targetX = localPuckX - wallSign * CONFIG.paddle.aiCornerAssistOffset;
        targetZ = localPuckZ - 0.26;
      } else if (localPuckVz > CONFIG.paddle.aiDangerExitSpeed) {
        targetX = clamp(localPuckX * 0.65, -maxX, maxX);
        targetZ = defendZ;
      } else {
        const clearTarget = this.buildShotTarget(
          selfDisc,
          localPuckX,
          localPuckZ,
          maxX,
          maxZ,
          minZ,
          { forwardOnly }
        );
        targetX = clearTarget.x;
        targetZ = clearTarget.z;
      }
    } else if (incomingThreat || ownHalfPuck || this.pressureTimer > 0) {
      const maxPredictionTime = this.skill === "pro" ? 1.25 : 0.95;
      let strikeTime = 0.18;
      if (incomingThreat && localPuckVz < -0.1) {
        strikeTime = (interceptZ - localPuckZ) / localPuckVz;
      }
      strikeTime = clamp(strikeTime, 0.05, maxPredictionTime);
      const predictedX = predictPuckXAfterTime(
        localPuckX,
        localPuckVx,
        strikeTime,
        maxX - 0.03
      );
      const predictedZ = clamp(localPuckZ + localPuckVz * strikeTime, minZ, maxZ);
      const strikeTarget = this.buildShotTarget(
        selfDisc,
        predictedX,
        predictedZ,
        maxX,
        maxZ,
        minZ,
        { forwardOnly }
      );
      targetX = strikeTarget.x;
      targetZ = strikeTarget.z;
    } else {
      const homeBias = clamp(localPuckX * 0.24 + this.laneBias * 0.35, -maxX * 0.62, maxX * 0.62);
      targetX = homeBias;
      targetZ = defendZ + clamp(localPuckZ * 0.08, -0.75, 0.72);

      if (puckSpeed < 0.95 && localPuckZ > -4.2) {
        targetX = localDiscX + (homeBias - localDiscX) * 0.5;
        targetZ = defendZ;
      }

      if (Math.abs(localDiscZ - defendZ) > 4.2) {
        targetZ = clamp((localDiscZ + defendZ) * 0.5, minZ, maxZ);
      }
    }

    targetX = clamp(targetX, -maxX, maxX);
    targetZ = clamp(targetZ, minZ, maxZ);

    const smoothing = this.skill === "pro" ? 0.5 : 0.38;
    this.lastTargetX += (targetX - this.lastTargetX) * smoothing;
    this.lastTargetZ += (targetZ - this.lastTargetZ) * smoothing;

    return {
      x: this.lastTargetX,
      z: this.lastTargetZ * this.zMirror,
    };
  }
}
