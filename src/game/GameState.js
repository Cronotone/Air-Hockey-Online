import { CONFIG } from "../config.js";

export class GameState {
  constructor() {
    this.mode = "ai";
    this.playerScore = 0;
    this.opponentScore = 0;
    this.isMatchActive = false;
    this.isPaused = false;
    this.isRoundLive = false;
    this.serveTimer = 0;
    this.serveDirection = 1;
    this.winner = null;
  }

  start(mode) {
    this.mode = mode;
    this.playerScore = 0;
    this.opponentScore = 0;
    this.winner = null;
    this.isMatchActive = true;
    this.isPaused = false;
    this.queueServe(Math.random() < 0.5 ? -1 : 1);
  }

  queueServe(direction) {
    this.isRoundLive = false;
    this.serveDirection = direction;
    this.serveTimer = CONFIG.match.serveDelay;
  }

  update(dt) {
    if (!this.isMatchActive || this.isPaused || this.isRoundLive) {
      return false;
    }

    this.serveTimer -= dt;
    if (this.serveTimer <= 0) {
      this.serveTimer = 0;
      this.isRoundLive = true;
      return true;
    }
    return false;
  }

  scorePoint(side) {
    if (side === "player") {
      this.playerScore += 1;
    } else {
      this.opponentScore += 1;
    }

    const maxScore = Math.max(this.playerScore, this.opponentScore);
    if (maxScore >= CONFIG.match.targetScore) {
      this.isMatchActive = false;
      this.isRoundLive = false;
      this.winner = side;
      return { gameOver: true, winner: side };
    }

    this.queueServe(side === "player" ? -1 : 1);
    return { gameOver: false, winner: null };
  }

  pause() {
    if (!this.isMatchActive) {
      return;
    }
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  resetToMenu() {
    this.playerScore = 0;
    this.opponentScore = 0;
    this.winner = null;
    this.isMatchActive = false;
    this.isPaused = false;
    this.isRoundLive = false;
    this.serveTimer = 0;
    this.serveDirection = 1;
  }
}
