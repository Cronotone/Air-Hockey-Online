export class ReplaySystem {
  constructor(maxHistorySeconds = 10) {
    this.maxHistorySeconds = maxHistorySeconds;
    this.frames = [];
  }

  clear() {
    this.frames.length = 0;
  }

  record(time, playerDisc, opponentDisc, puck) {
    this.frames.push({
      time,
      playerX: playerDisc.mesh.position.x,
      playerZ: playerDisc.mesh.position.z,
      opponentX: opponentDisc.mesh.position.x,
      opponentZ: opponentDisc.mesh.position.z,
      puckX: puck.mesh.position.x,
      puckZ: puck.mesh.position.z,
    });

    const oldestAllowed = time - this.maxHistorySeconds;
    while (this.frames.length > 0 && this.frames[0].time < oldestAllowed) {
      this.frames.shift();
    }
  }

  buildGoalReplay(goalTime, attackingTouchTime, minimumDuration = 3, slowMoLead = 1, scorer = "player") {
    if (this.frames.length < 2) {
      return null;
    }

    const desiredStartTime =
      typeof attackingTouchTime === "number"
        ? Math.min(attackingTouchTime, goalTime - minimumDuration)
        : goalTime - minimumDuration;

    const earliest = this.frames[0].time;
    const startTime = Math.max(earliest, desiredStartTime);
    const clipFrames = this.frames.filter((frame) => frame.time >= startTime && frame.time <= goalTime);
    if (clipFrames.length < 2) {
      return null;
    }

    return {
      frames: clipFrames,
      startTime,
      endTime: goalTime,
      scorer,
      hitTime: typeof attackingTouchTime === "number" ? attackingTouchTime : null,
      slowMoStartTime: Math.max(startTime, goalTime - slowMoLead),
      playheadTime: startTime,
      frameIndex: 0,
      finished: false,
      cameraInitialized: false,
    };
  }

  updateReplay(replayState, dt, applyFrame) {
    if (!replayState || replayState.finished) {
      return true;
    }

    const speed = getReplaySpeed(replayState);
    replayState.playheadTime += dt * speed;
    if (replayState.playheadTime >= replayState.endTime) {
      replayState.playheadTime = replayState.endTime;
      replayState.finished = true;
    }

    const frames = replayState.frames;
    while (
      replayState.frameIndex < frames.length - 2 &&
      frames[replayState.frameIndex + 1].time <= replayState.playheadTime
    ) {
      replayState.frameIndex += 1;
    }

    const a = frames[replayState.frameIndex];
    const b = frames[Math.min(replayState.frameIndex + 1, frames.length - 1)];
    const span = Math.max(1e-6, b.time - a.time);
    const t = clamp((replayState.playheadTime - a.time) / span, 0, 1);
    applyFrame(lerpFrame(a, b, t));

    return replayState.finished;
  }
}

function getReplaySpeed(replayState) {
  let speed = replayState.playheadTime >= replayState.slowMoStartTime ? 0.28 : 1;

  if (typeof replayState.hitTime === "number") {
    const hitWindowStart = replayState.hitTime - 0.22;
    const hitWindowEnd = replayState.hitTime + 0.52;
    if (replayState.playheadTime >= hitWindowStart && replayState.playheadTime <= hitWindowEnd) {
      speed = Math.min(speed, 0.45);
    }
  }

  const goalWindowStart = replayState.endTime - 0.4;
  if (replayState.playheadTime >= goalWindowStart) {
    speed = Math.min(speed, 0.22);
  }

  return speed;
}

function lerpFrame(a, b, t) {
  return {
    playerX: lerp(a.playerX, b.playerX, t),
    playerZ: lerp(a.playerZ, b.playerZ, t),
    opponentX: lerp(a.opponentX, b.opponentX, t),
    opponentZ: lerp(a.opponentZ, b.opponentZ, t),
    puckX: lerp(a.puckX, b.puckX, t),
    puckZ: lerp(a.puckZ, b.puckZ, t),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
