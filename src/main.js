import { CONFIG } from "./config.js";
import { createSceneSetup } from "./core/SceneSetup.js";
import { GameLoop } from "./core/GameLoop.js";
import { GameState } from "./game/GameState.js";
import { ReplaySystem } from "./game/ReplaySystem.js";
import { PowerupSystem, POWERUP_TYPES } from "./game/PowerupSystem.js";
import {
  enforceDiscBounds,
  getDiscBounds,
  moveDiscTowardTarget,
  updatePuckPhysics,
} from "./game/CollisionSystem.js";
import { Padel } from "./entities/padel.js";
import { Ball } from "./entities/ball.js";
import { ConfettiSystem } from "./entities/ConfettiSystem.js";
import { GameAudio } from "./audio/GameAudio.js";
import { createTableArena } from "./entities/TableArena.js";
import { createStadiumBackdrop } from "./entities/StadiumBackdrop.js";
import { FixedBehindCamera } from "./camera/FixedBehindCamera.js";
import { AIOpponent } from "./ai/AIOpponent.js";
import { HUD } from "./ui/HUD.js";
import { StartMenu } from "./ui/StartMenu.js";
import { PauseMenu } from "./ui/PauseMenu.js";

const appRoot = document.getElementById("app");
const uiRoot = document.getElementById("ui-root");
if (!appRoot || !uiRoot) {
  throw new Error("Missing UI containers in index.html");
}

const { THREE, scene, camera, renderer } = createSceneSetup(appRoot);

const tableArena = createTableArena();
scene.add(tableArena);

const stadium = createStadiumBackdrop();
scene.add(stadium);

const confettiSystem = new ConfettiSystem(scene);
const powerupSystem = new PowerupSystem(scene);
const gameAudio = new GameAudio();

const playerStartZ = CONFIG.table.length * 0.5 - CONFIG.table.wallThickness - CONFIG.paddle.radius - 1.6;
const opponentStartZ = -playerStartZ;

const playerPadel = new Padel({
  color: 0x2ed0ff,
  zPosition: playerStartZ,
});
scene.add(playerPadel.mesh);

const opponentPadel = new Padel({
  color: 0xff9251,
  zPosition: opponentStartZ,
});
scene.add(opponentPadel.mesh);

const ball = new Ball();
scene.add(ball.mesh);

const cameraRig = new FixedBehindCamera();
const aiOpponent = new AIOpponent({ side: "opponent", skill: "standard" });
const aiPlayer = new AIOpponent({ side: "player", skill: "pro" });
const gameState = new GameState();
const replaySystem = new ReplaySystem(10);

const hud = new HUD(uiRoot);
const startMenu = new StartMenu(uiRoot);
const pauseMenu = new PauseMenu(uiRoot);
const ENABLE_JUMPSCARE = false;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const movementPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -(CONFIG.table.surfaceY + CONFIG.paddle.height * 0.5)
);
const mousePlaneHit = new THREE.Vector3();
const replayCamDesiredPos = new THREE.Vector3();
const replayCamDesiredLook = new THREE.Vector3();
const replayCamShotDir = new THREE.Vector3();
const replayCamSideDir = new THREE.Vector3();
const replayCamGoalDir = new THREE.Vector3();
const replayCamHitMidpoint = new THREE.Vector3();
const replayPrevPuckPos = new THREE.Vector3();
const sideCamDesiredPos = new THREE.Vector3();
const sideCamLookTarget = new THREE.Vector3();
const twoPlayerCamDesiredPos = new THREE.Vector3();
const twoPlayerCamLookTarget = new THREE.Vector3();
const projectedPointer = new THREE.Vector3();
const jumpscareOverlay = ENABLE_JUMPSCARE ? createJumpscareOverlay(uiRoot) : null;

let hasMouseTarget = false;
let mouseTargetX = 0;
let mouseTargetZ = playerStartZ;
let hasOpponentTouchTarget = false;
let opponentTouchTargetX = 0;
let opponentTouchTargetZ = opponentStartZ;
let gameClock = 0;
let replayState = null;
let pendingGoalOutcome = null;
let replayHasPrevPuck = false;
let jumpscareElapsed = 0;
let jumpscareTriggerTime = randomRange(12, 48);
let jumpscareShown = false;
let jumpscareSoundPlayed = false;
let jumpscareVisible = false;
let jumpscareHideTimer = 0;
let selectedBetSide = null;
let playerBlindVisualTimer = 0;
let nextPowerupSpawnAt = 0;
const powerupPickups = {
  player: 0,
  opponent: 0,
};
const lastTouchTimes = {
  player: null,
  opponent: null,
};

const gameplayOptions = {
  powerupsEnabled: true,
};

const effectTimers = {
  player: {
    sizeBoost: 0,
    goalShield: 0,
  },
  opponent: {
    sizeBoost: 0,
    goalShield: 0,
  },
};

function isAiVsAiMode() {
  return gameState.mode === "ai-vs-ai";
}

function isTwoPlayerMode() {
  return gameState.mode === "two-player";
}

function scheduleNextPowerupSpawn(minDelay = 2, maxDelay = 6) {
  nextPowerupSpawnAt = gameClock + randomRange(minDelay, maxDelay);
}

function scheduleBasePowerupSpawn() {
  scheduleNextPowerupSpawn(2, 6);
}

function getPreferredPowerupSide() {
  if (!gameplayOptions.powerupsEnabled) {
    return null;
  }

  if (gameState.mode === "ai") {
    // 1P vs AI: bias toward player, but AI still gets powerups.
    const playerBias = powerupPickups.player <= powerupPickups.opponent ? 0.72 : 0.62;
    return Math.random() < playerBias ? "player" : "opponent";
  }

  if (gameState.mode === "ai-vs-ai" || gameState.mode === "two-player") {
    if (powerupPickups.player < powerupPickups.opponent) {
      return "player";
    }
    if (powerupPickups.opponent < powerupPickups.player) {
      return "opponent";
    }
  }

  return null;
}

function isMobileInputDevice() {
  return (
    window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}

function getSideLabel(side) {
  if (isAiVsAiMode()) {
    return side === "player" ? "Blue AI" : "Orange AI";
  }
  if (isTwoPlayerMode()) {
    return side === "player" ? "Bottom Player" : "Top Player";
  }
  return side === "player" ? "Player 1" : "AI";
}

function getBetResultText(winnerSide) {
  if (!isAiVsAiMode() || !selectedBetSide) {
    return "";
  }
  return selectedBetSide === winnerSide ? "Bet Won" : "Bet Lost";
}

function getPlayerControlConfig() {
  if (isAiVsAiMode()) {
    return {
      maxSpeed: CONFIG.paddle.aiProMaxSpeed,
      acceleration: CONFIG.paddle.aiProAcceleration,
      linearDamping: CONFIG.paddle.aiProLinearDamping,
    };
  }
  return {
    maxSpeed: CONFIG.paddle.maxSpeed,
    acceleration: CONFIG.paddle.acceleration,
    linearDamping: CONFIG.paddle.linearDamping,
  };
}

function getOpponentControlConfig() {
  if (isAiVsAiMode()) {
    return {
      maxSpeed: CONFIG.paddle.aiProMaxSpeed,
      acceleration: CONFIG.paddle.aiProAcceleration,
      linearDamping: CONFIG.paddle.aiProLinearDamping,
    };
  }
  if (isTwoPlayerMode()) {
    return {
      maxSpeed: CONFIG.paddle.maxSpeed,
      acceleration: CONFIG.paddle.acceleration,
      linearDamping: CONFIG.paddle.linearDamping,
    };
  }
  return {
    maxSpeed: CONFIG.paddle.aiMaxSpeed,
    acceleration: CONFIG.paddle.aiAcceleration,
    linearDamping: CONFIG.paddle.aiLinearDamping,
  };
}

function resetPositions() {
  playerPadel.reset(0, playerStartZ);
  opponentPadel.reset(0, opponentStartZ);
  ball.resetPosition();
  hasMouseTarget = false;
  hasOpponentTouchTarget = false;
  mouseTargetX = 0;
  mouseTargetZ = playerStartZ;
  opponentTouchTargetX = 0;
  opponentTouchTargetZ = opponentStartZ;
  aiPlayer.reset();
  aiOpponent.reset();
}

function clearPowerupEffects() {
  effectTimers.player.sizeBoost = 0;
  effectTimers.player.goalShield = 0;
  effectTimers.opponent.sizeBoost = 0;
  effectTimers.opponent.goalShield = 0;
  playerBlindVisualTimer = 0;
  hud.setBlindOverlayVisible(false);
  hud.hidePowerupBanner();
  playerPadel.setScaleFactor(1);
  opponentPadel.setScaleFactor(1);
  aiPlayer.setBlind(0);
  aiOpponent.setBlind(0);
  syncGoalVisuals();
  scheduleBasePowerupSpawn();
}

function getGoalScale(side) {
  return effectTimers[side].goalShield > 0 ? 0.5 : 1;
}

function syncGoalVisuals() {
  const setGoalScales = tableArena && tableArena.userData ? tableArena.userData.setGoalScales : null;
  if (typeof setGoalScales === "function") {
    setGoalScales(getGoalScale("player"), getGoalScale("opponent"));
  }
}

function updateEffectTimers(dt) {
  for (const side of ["player", "opponent"]) {
    effectTimers[side].sizeBoost = Math.max(0, effectTimers[side].sizeBoost - dt);
    effectTimers[side].goalShield = Math.max(0, effectTimers[side].goalShield - dt);
  }

  playerPadel.setScaleFactor(effectTimers.player.sizeBoost > 0 ? 2 : 1);
  opponentPadel.setScaleFactor(effectTimers.opponent.sizeBoost > 0 ? 2 : 1);
  syncGoalVisuals();

  playerBlindVisualTimer = Math.max(0, playerBlindVisualTimer - dt);
  hud.setBlindOverlayVisible(playerBlindVisualTimer > 0);
}

function getPowerupChaseTarget(side, fallbackTarget) {
  if (!gameplayOptions.powerupsEnabled) {
    return fallbackTarget;
  }

  const pickup = powerupSystem.getActivePickup();
  if (!pickup) {
    return fallbackTarget;
  }

  const inOwnHalf = side === "player" ? pickup.z >= -0.25 : pickup.z <= 0.25;
  if (!inOwnHalf) {
    return fallbackTarget;
  }

  const urgentDefense =
    (side === "player" && ball.mesh.position.z > CONFIG.table.length * 0.33 && ball.velocity.z > 0.2) ||
    (side === "opponent" && ball.mesh.position.z < -CONFIG.table.length * 0.33 && ball.velocity.z < -0.2);
  if (urgentDefense) {
    return fallbackTarget;
  }

  return {
    x: pickup.x,
    z: pickup.z,
  };
}

function applyPowerup(pickup) {
  if (!pickup) {
    return;
  }

  const side = pickup.side;
  powerupPickups[side] += 1;
  const opponentSide = side === "player" ? "opponent" : "player";
  const type = pickup.type.id;
  hud.showPowerupBanner(`${getSideLabel(side)} picked ${pickup.type.label}`, side);
  scheduleNextPowerupSpawn(pickup.type.duration + 2, pickup.type.duration + 6);

  if (type === POWERUP_TYPES.sizeBoost.id) {
    effectTimers[side].sizeBoost = Math.max(effectTimers[side].sizeBoost, POWERUP_TYPES.sizeBoost.duration);
    return;
  }

  if (type === POWERUP_TYPES.goalShield.id) {
    effectTimers[side].goalShield = Math.max(effectTimers[side].goalShield, POWERUP_TYPES.goalShield.duration);
    return;
  }

  if (type === POWERUP_TYPES.blind.id) {
    if (gameState.mode === "ai") {
      if (side === "player") {
        aiOpponent.setBlind(POWERUP_TYPES.blind.duration);
      } else if (side === "opponent") {
        playerBlindVisualTimer = Math.max(playerBlindVisualTimer, POWERUP_TYPES.blind.duration);
      }
    } else if (gameState.mode === "ai-vs-ai") {
      if (opponentSide === "opponent") {
        aiOpponent.setBlind(POWERUP_TYPES.blind.duration);
      } else if (opponentSide === "player") {
        aiPlayer.setBlind(POWERUP_TYPES.blind.duration);
      }
    }
  }
}

function refreshServeStatus() {
  if (!gameState.isMatchActive) {
    return;
  }
  if (gameState.isPaused) {
    hud.setStatus("Paused");
    return;
  }
  if (gameState.isRoundLive) {
    hud.setStatus("");
    return;
  }
  const betText =
    isAiVsAiMode() && selectedBetSide ? `Bet: ${getSideLabel(selectedBetSide)} | ` : "";
  hud.setStatus(`${betText}Faceoff in ${Math.max(0, gameState.serveTimer).toFixed(1)}s`);
}

function startMatch(matchSetup = null) {
  const requestedMode =
    matchSetup && (matchSetup.mode === "ai-vs-ai" || matchSetup.mode === "two-player")
      ? matchSetup.mode
      : "ai";
  const mode = requestedMode === "two-player" && !isMobileInputDevice() ? "ai" : requestedMode;
  selectedBetSide =
    mode === "ai-vs-ai" && (matchSetup?.betSide === "player" || matchSetup?.betSide === "opponent")
      ? matchSetup.betSide
      : null;
  powerupPickups.player = 0;
  powerupPickups.opponent = 0;

  gameAudio.unlock();
  gameState.start(mode);
  aiOpponent.setSkill(mode === "ai-vs-ai" ? "pro" : "standard");
  aiPlayer.setSkill("pro");
  replayState = null;
  pendingGoalOutcome = null;
  replaySystem.clear();
  lastTouchTimes.player = null;
  lastTouchTimes.opponent = null;
  replayHasPrevPuck = false;
  gameClock = 0;
  jumpscareElapsed = 0;
  jumpscareTriggerTime = randomRange(12, 48);
  jumpscareShown = false;
  jumpscareSoundPlayed = false;
  jumpscareVisible = false;
  jumpscareHideTimer = 0;
  if (jumpscareOverlay) {
    jumpscareOverlay.classList.remove("visible");
  }
  clearPowerupEffects();
  powerupSystem.setEnabled(gameplayOptions.powerupsEnabled);
  powerupSystem.reset();
  scheduleBasePowerupSpawn();
  resetPositions();
  hud.setMode(mode);
  hud.setScore(0, 0);
  hud.setPauseButtonEnabled(true);
  hud.setPauseButtonLabel("Pause");
  hud.hideGoalBanner();
  refreshServeStatus();
  pauseMenu.hide();
  startMenu.hide();
}

function finishMatch() {
  const winnerText = getSideLabel(gameState.winner);
  const betResultText = getBetResultText(gameState.winner);
  const statusText = betResultText ? `${winnerText} wins the final | ${betResultText}` : `${winnerText} wins the final`;
  clearPowerupEffects();
  powerupSystem.reset();
  hud.setPauseButtonEnabled(false);
  hud.setPauseButtonLabel("Pause");
  hud.setStatus(statusText);
  pauseMenu.hide();
  startMenu.showGameOver(winnerText, startMatch, betResultText);
}

function returnToMainMenu() {
  gameState.resetToMenu();
  gameState.mode = "ai";
  selectedBetSide = null;
  replayState = null;
  pendingGoalOutcome = null;
  replaySystem.clear();
  replayHasPrevPuck = false;
  jumpscareShown = false;
  jumpscareSoundPlayed = false;
  jumpscareVisible = false;
  jumpscareHideTimer = 0;
  if (jumpscareOverlay) {
    jumpscareOverlay.classList.remove("visible");
  }
  clearPowerupEffects();
  powerupSystem.reset();
  powerupSystem.setEnabled(gameplayOptions.powerupsEnabled);
  scheduleBasePowerupSpawn();
  resetPositions();
  hud.setScore(0, 0);
  hud.setStatus("Choose start to begin");
  hud.setPauseButtonEnabled(false);
  hud.setPauseButtonLabel("Pause");
  hud.hideGoalBanner();
  pauseMenu.hide();
  startMenu.show(startMatch);
}

function pauseMatch() {
  if (!gameState.isMatchActive || gameState.isPaused || startMenu.isVisible()) {
    return;
  }
  gameState.pause();
  hud.setPauseButtonLabel("Resume");
  refreshServeStatus();
  pauseMenu.show();
}

function resumeMatch() {
  if (!gameState.isPaused) {
    return;
  }
  gameState.resume();
  hud.setPauseButtonLabel("Pause");
  pauseMenu.hide();
  refreshServeStatus();
}

function togglePause() {
  if (!gameState.isMatchActive || startMenu.isVisible()) {
    return;
  }
  if (gameState.isPaused) {
    resumeMatch();
  } else {
    pauseMatch();
  }
}

function projectToMovementPlane(clientX, clientY, outVector) {
  movementPlane.constant = -(CONFIG.table.surfaceY + playerPadel.height * 0.5);
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);

  if (raycaster.ray.intersectPlane(movementPlane, outVector)) {
    return true;
  }
  return false;
}

function updateMouseTarget(clientX, clientY) {
  if (projectToMovementPlane(clientX, clientY, mousePlaneHit)) {
    mouseTargetX = mousePlaneHit.x;
    mouseTargetZ = mousePlaneHit.z;
    hasMouseTarget = true;
  }
}

function updateTouchTarget(event) {
  if (event.cancelable) {
    event.preventDefault();
  }
  if (skipReplayIfActive()) {
    return;
  }

  gameAudio.unlock();
  if (!isTwoPlayerMode()) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) {
      return;
    }
    updateMouseTarget(touch.clientX, touch.clientY);
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const splitY = rect.top + rect.height * 0.5;
  let updatedBottom = false;
  let updatedTop = false;

  const touches = event.touches && event.touches.length > 0 ? event.touches : event.changedTouches;
  for (let i = 0; i < touches.length; i += 1) {
    const touch = touches[i];
    if (!projectToMovementPlane(touch.clientX, touch.clientY, projectedPointer)) {
      continue;
    }
    if (touch.clientY >= splitY) {
      mouseTargetX = projectedPointer.x;
      mouseTargetZ = projectedPointer.z;
      hasMouseTarget = true;
      updatedBottom = true;
    } else {
      opponentTouchTargetX = projectedPointer.x;
      opponentTouchTargetZ = projectedPointer.z;
      hasOpponentTouchTarget = true;
      updatedTop = true;
    }
  }

  if (!updatedBottom && (!event.touches || event.touches.length === 0)) {
    hasMouseTarget = false;
  }
  if (!updatedTop && (!event.touches || event.touches.length === 0)) {
    hasOpponentTouchTarget = false;
  }
}

function applyReplayFrame(frame) {
  playerPadel.setPosition(frame.playerX, frame.playerZ);
  opponentPadel.setPosition(frame.opponentX, frame.opponentZ);
  ball.mesh.position.x = frame.puckX;
  ball.mesh.position.z = frame.puckZ;
}

function beginGoalSequence(scorer, scoreResult) {
  clearPowerupEffects();
  powerupSystem.reset();
  confettiSystem.triggerGoalBurst(scorer);
  gameAudio.playGoal(scorer === "player");
  hud.showGoalBanner(`${getSideLabel(scorer)} Scored`, scorer);

  const goalTime = gameClock;
  const attackingTouchTime = lastTouchTimes[scorer];
  replayState = replaySystem.buildGoalReplay(goalTime, attackingTouchTime, 3, 1, scorer);
  pendingGoalOutcome = scoreResult;
  replayHasPrevPuck = false;

  if (!replayState) {
    completeGoalSequence();
    return;
  }

  hud.setStatus("Instant Replay (Left Click to Skip)");
}

function completeGoalSequence() {
  replayState = null;
  replaySystem.clear();
  lastTouchTimes.player = null;
  lastTouchTimes.opponent = null;
  replayHasPrevPuck = false;
  resetPositions();

  const finishedMatch = pendingGoalOutcome && pendingGoalOutcome.gameOver;
  pendingGoalOutcome = null;

  if (finishedMatch) {
    finishMatch();
  } else {
    refreshServeStatus();
  }
}

function skipReplayIfActive() {
  if (!replayState) {
    return false;
  }
  completeGoalSequence();
  return true;
}

function createJumpscareOverlay(root) {
  const overlay = document.createElement("div");
  overlay.className = "jumpscare-overlay";
  const img = document.createElement("img");
  img.src = "./src/assets/images/scary-entity.webp";
  img.alt = "Scary entity";
  overlay.append(img);
  root.append(overlay);
  return overlay;
}

function triggerJumpscare() {
  if (!ENABLE_JUMPSCARE || !jumpscareOverlay) {
    return;
  }
  jumpscareShown = true;
  jumpscareVisible = true;
  jumpscareHideTimer = Math.max(0.2, gameAudio.getJumpscareRemainingSeconds());
  jumpscareOverlay.classList.add("visible");
}

function updateJumpscare(dt) {
  if (!ENABLE_JUMPSCARE || !jumpscareOverlay) {
    return;
  }
  if (!jumpscareVisible) {
    return;
  }

  if (gameAudio.isJumpscarePlaying()) {
    jumpscareHideTimer = Math.max(jumpscareHideTimer, gameAudio.getJumpscareRemainingSeconds());
  }

  jumpscareHideTimer -= dt;
  if (jumpscareHideTimer <= 0 && !gameAudio.isJumpscarePlaying()) {
    jumpscareVisible = false;
    jumpscareOverlay.classList.remove("visible");
  }
}

function updateReplayCamera(dt) {
  if (!replayState) {
    return;
  }

  const scorerDisc = replayState.scorer === "player" ? playerPadel : opponentPadel;
  const puckPosition = ball.mesh.position;
  const goalZ = replayState.scorer === "player" ? -CONFIG.table.length * 0.5 : CONFIG.table.length * 0.5;

  replayCamGoalDir.set(0, 0, goalZ).sub(puckPosition);
  if (replayHasPrevPuck) {
    replayCamShotDir.set(
      puckPosition.x - replayPrevPuckPos.x,
      0,
      puckPosition.z - replayPrevPuckPos.z
    );
  } else {
    replayCamShotDir.set(0, 0, 0);
  }
  replayPrevPuckPos.copy(puckPosition);
  replayHasPrevPuck = true;

  if (replayCamShotDir.lengthSq() < 0.06) {
    replayCamShotDir.copy(replayCamGoalDir);
  }
  if (replayCamShotDir.lengthSq() < 0.06) {
    replayCamShotDir.set(0, 0, Math.sign(goalZ) || 1);
  }
  replayCamShotDir.normalize();
  replayCamSideDir.set(-replayCamShotDir.z, 0, replayCamShotDir.x).normalize();

  const hitZoom =
    typeof replayState.hitTime === "number"
      ? bellPulse(replayState.playheadTime, replayState.hitTime + 0.08, 0.45)
      : 0;
  const goalZoom = bellPulse(replayState.playheadTime, replayState.endTime - 0.06, 0.44);
  const zoomFactor = Math.max(hitZoom, goalZoom);

  const focusContact =
    typeof replayState.hitTime === "number"
      ? bellPulse(replayState.playheadTime, replayState.hitTime + 0.05, 0.55)
      : 0;

  replayCamHitMidpoint
    .copy(scorerDisc.mesh.position)
    .add(puckPosition)
    .multiplyScalar(0.5);
  const goalLookY = CONFIG.table.surfaceY + 0.34;
  replayCamDesiredLook.set(0, goalLookY, goalZ);
  const hitLookBias = focusContact * (1 - goalZoom * 0.8) * 0.42;
  replayCamDesiredLook
    .lerp(replayCamHitMidpoint, hitLookBias);
  replayCamDesiredLook.y = lerp(goalLookY, CONFIG.table.surfaceY + 0.52, hitLookBias);

  const distance = lerp(6.5, 3.2, zoomFactor);
  const height = lerp(2.6, 1.24, zoomFactor);
  const sideOffset = lerp(2.35, 1.05, zoomFactor);

  replayCamDesiredPos
    .copy(puckPosition)
    .addScaledVector(replayCamShotDir, -distance)
    .addScaledVector(replayCamSideDir, sideOffset);
  replayCamDesiredPos.y = CONFIG.table.surfaceY + height;

  if (!replayState.cameraInitialized) {
    camera.position.copy(replayCamDesiredPos);
    replayState.cameraInitialized = true;
  } else {
    const smoothing = 1 - Math.pow(1 - 0.17, dt * 60);
    camera.position.lerp(replayCamDesiredPos, smoothing);
  }

  camera.lookAt(replayCamDesiredLook);
}

function updateSideSpectatorCamera(dt) {
  const panZ = clamp(ball.mesh.position.z * 0.22, -6.4, 6.4);
  sideCamDesiredPos.set(
    CONFIG.table.width * 0.95,
    CONFIG.table.surfaceY + 8.5,
    panZ
  );
  const smoothing = 1 - Math.pow(1 - 0.11, dt * 60);
  camera.position.lerp(sideCamDesiredPos, smoothing);

  sideCamLookTarget.set(
    ball.mesh.position.x * 0.2,
    CONFIG.table.surfaceY + 0.3,
    ball.mesh.position.z * 0.4
  );
  camera.lookAt(sideCamLookTarget);
}

function updateTwoPlayerCamera(dt) {
  twoPlayerCamDesiredPos.set(0, CONFIG.table.surfaceY + 27.5, 0.01);
  const smoothing = 1 - Math.pow(1 - 0.12, dt * 60);
  camera.position.lerp(twoPlayerCamDesiredPos, smoothing);
  twoPlayerCamLookTarget.set(0, CONFIG.table.surfaceY + 0.2, 0);
  camera.lookAt(twoPlayerCamLookTarget);
}

function updateLiveCamera(dt) {
  if (isAiVsAiMode()) {
    updateSideSpectatorCamera(dt);
    return;
  }
  if (isTwoPlayerMode()) {
    updateTwoPlayerCamera(dt);
    return;
  }
  cameraRig.update(camera, playerPadel, ball, dt);
}

hud.setPauseHandler(togglePause);
pauseMenu.onResume = resumeMatch;
pauseMenu.onMainMenu = returnToMainMenu;
pauseMenu.setPowerupsEnabled(gameplayOptions.powerupsEnabled);
pauseMenu.onPowerupsToggle = (enabled) => {
  gameplayOptions.powerupsEnabled = !!enabled;
  powerupSystem.setEnabled(gameplayOptions.powerupsEnabled);
  if (!gameplayOptions.powerupsEnabled) {
    clearPowerupEffects();
  } else {
    scheduleBasePowerupSpawn();
  }
};

renderer.domElement.addEventListener("pointermove", (event) => {
  updateMouseTarget(event.clientX, event.clientY);
});
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button === 0 && skipReplayIfActive()) {
    return;
  }
  gameAudio.unlock();
  updateMouseTarget(event.clientX, event.clientY);
});
renderer.domElement.addEventListener("touchstart", updateTouchTarget, { passive: false });
renderer.domElement.addEventListener("touchmove", updateTouchTarget, { passive: false });

window.addEventListener("keydown", (event) => {
  gameAudio.unlock();
  if (event.code === "Escape" || event.code === "KeyP" || event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

startMenu.show(startMatch);
updateLiveCamera(1 / 60);

const loop = new GameLoop(
  (dt) => {
    gameAudio.tick(dt);
    updateJumpscare(dt);
    if (gameState.isMatchActive && !gameState.isPaused && !replayState) {
      updateEffectTimers(dt);
      const canSpawnPowerup = gameState.isRoundLive && gameClock >= nextPowerupSpawnAt;
      powerupSystem.update(dt, canSpawnPowerup, {
        allowBlind: !isTwoPlayerMode(),
        preferredSide: getPreferredPowerupSide(),
      });
    }

    if (gameState.isPaused) {
      confettiSystem.update(dt);
      if (replayState) {
        updateReplayCamera(0);
      } else {
        updateLiveCamera(dt);
      }
      return;
    }

    if (replayState) {
      const replayFinished = replaySystem.updateReplay(replayState, dt, applyReplayFrame);
      confettiSystem.update(dt);
      updateReplayCamera(dt);
      if (replayFinished) {
        completeGoalSequence();
      }
      return;
    }

    if (!gameState.isMatchActive) {
      confettiSystem.update(dt);
      updateLiveCamera(dt);
      return;
    }

    const playerBounds = getDiscBounds("player", playerPadel.radius);
    const opponentBounds = getDiscBounds("opponent", opponentPadel.radius);

    const shouldServe = gameState.update(dt);
    if (shouldServe) {
      ball.serve(gameState.serveDirection);
      hud.hideGoalBanner();
    }

    if (gameState.isRoundLive) {
      if (ENABLE_JUMPSCARE) {
        jumpscareElapsed += dt;
        if (!jumpscareSoundPlayed && jumpscareElapsed >= jumpscareTriggerTime - 1) {
          jumpscareSoundPlayed = true;
          gameAudio.playJumpscare();
        }
        if (!jumpscareShown && jumpscareElapsed >= jumpscareTriggerTime) {
          triggerJumpscare();
        }
      }

      const isAiMatch = isAiVsAiMode();
      const isTwoPlayer = isTwoPlayerMode();
      const aiBehavior = isAiMatch ? { forwardOnly: true, deepDefense: true } : null;
      const playerTargetX = hasMouseTarget ? mouseTargetX : playerPadel.mesh.position.x;
      const playerTargetZ = hasMouseTarget ? mouseTargetZ : playerPadel.mesh.position.z;
      const opponentTouchX = hasOpponentTouchTarget ? opponentTouchTargetX : opponentPadel.mesh.position.x;
      const opponentTouchZ = hasOpponentTouchTarget ? opponentTouchTargetZ : opponentPadel.mesh.position.z;
      const playerControlConfig = getPlayerControlConfig();
      const opponentControlConfig = getOpponentControlConfig();

      const substeps = getPhysicsSubsteps(dt);
      const stepDt = dt / substeps;

      for (let i = 0; i < substeps; i += 1) {
        if (isAiMatch) {
          const aiPlayerBaseTarget = aiPlayer.getTarget(playerPadel, ball, stepDt, aiBehavior);
          const aiPlayerTarget = getPowerupChaseTarget("player", aiPlayerBaseTarget);
          moveDiscTowardTarget(
            playerPadel,
            aiPlayerTarget.x,
            aiPlayerTarget.z,
            stepDt,
            playerControlConfig,
            playerBounds
          );
        } else {
          moveDiscTowardTarget(
            playerPadel,
            playerTargetX,
            playerTargetZ,
            stepDt,
            playerControlConfig,
            playerBounds
          );
        }

        if (isTwoPlayer) {
          moveDiscTowardTarget(
            opponentPadel,
            opponentTouchX,
            opponentTouchZ,
            stepDt,
            opponentControlConfig,
            opponentBounds
          );
        } else {
          const aiBaseTarget = aiOpponent.getTarget(opponentPadel, ball, stepDt, aiBehavior);
          const aiTarget = getPowerupChaseTarget("opponent", aiBaseTarget);
          moveDiscTowardTarget(
            opponentPadel,
            aiTarget.x,
            aiTarget.z,
            stepDt,
            opponentControlConfig,
            opponentBounds
          );
        }

        if (gameplayOptions.powerupsEnabled) {
          const playerPickup = powerupSystem.collectForDisc(playerPadel, "player");
          if (playerPickup) {
            applyPowerup(playerPickup);
          }
          const opponentPickup = powerupSystem.collectForDisc(opponentPadel, "opponent");
          if (opponentPickup) {
            applyPowerup(opponentPickup);
          }
        }

        gameClock += stepDt;
        const scorer = updatePuckPhysics(ball, playerPadel, opponentPadel, stepDt, {
          onDiscHit: (side, impulseMagnitude) => {
            lastTouchTimes[side] = gameClock;
            if (side === "player" && isAiMatch) {
              aiPlayer.noteHit(ball.velocity);
            }
            if (side === "opponent") {
              aiOpponent.noteHit(ball.velocity);
            }
            gameAudio.playPuckHit(Math.min(1.6, impulseMagnitude / 9));
          },
          onWallHit: (speed) => {
            gameAudio.playWallHit(speed);
          },
        }, {
          playerGoalScale: getGoalScale("player"),
          opponentGoalScale: getGoalScale("opponent"),
        });
        replaySystem.record(gameClock, playerPadel, opponentPadel, ball);
        enforceDiscBounds(playerPadel, playerBounds);
        enforceDiscBounds(opponentPadel, opponentBounds);

        if (scorer) {
          const scoreResult = gameState.scorePoint(scorer);
          hud.setScore(gameState.playerScore, gameState.opponentScore);
          beginGoalSequence(scorer, scoreResult);
          break;
        }
      }
    }

    if (replayState) {
      confettiSystem.update(dt);
      updateReplayCamera(dt);
      return;
    }

    confettiSystem.update(dt);
    refreshServeStatus();
    updateLiveCamera(dt);
  },
  () => {
    renderer.render(scene, camera);
  }
);

loop.start();

function getPhysicsSubsteps(dt) {
  const puckSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
  const playerSpeed = Math.hypot(playerPadel.velocity.x, playerPadel.velocity.z);
  const aiSpeed = Math.hypot(opponentPadel.velocity.x, opponentPadel.velocity.z);
  const cappedReference = Math.max(
    typeof CONFIG.paddle.maxSpeed === "number" ? CONFIG.paddle.maxSpeed : 0,
    typeof CONFIG.paddle.aiMaxSpeed === "number" ? CONFIG.paddle.aiMaxSpeed : 0,
    typeof CONFIG.ball.maxSpeed === "number" ? CONFIG.ball.maxSpeed : 0
  );
  const referenceSpeed = Math.max(cappedReference, puckSpeed, playerSpeed, aiSpeed);
  const estimatedTravel = referenceSpeed * dt;
  const steps = Math.ceil(estimatedTravel / CONFIG.physics.maxTravelPerStep);
  return Math.max(1, Math.min(CONFIG.physics.maxSubsteps, steps));
}

function bellPulse(time, center, width) {
  const distance = Math.abs(time - center);
  if (distance >= width) {
    return 0;
  }
  const x = distance / width;
  return 1 - x * x;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
