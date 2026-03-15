export class HUD {
  constructor(root) {
    this.root = root;
    this.onPause = null;
    this.powerupBannerTimeout = null;

    this.element = document.createElement("div");
    this.element.className = "hud";

    this.modeElement = document.createElement("div");
    this.modeElement.className = "hud-mode";
    this.modeElement.textContent = "Mode: -";

    this.scoreElement = document.createElement("div");
    this.scoreElement.className = "hud-score";
    this.scoreElement.textContent = "0 : 0";

    this.statusElement = document.createElement("div");
    this.statusElement.className = "hud-status";
    this.statusElement.textContent = "Press Start to begin";

    this.element.append(this.modeElement, this.scoreElement, this.statusElement);
    this.root.append(this.element);

    this.pauseButton = document.createElement("button");
    this.pauseButton.type = "button";
    this.pauseButton.className = "hud-pause";
    this.pauseButton.textContent = "Pause";
    this.pauseButton.disabled = true;
    this.pauseButton.addEventListener("click", () => {
      if (typeof this.onPause === "function") {
        this.onPause();
      }
    });
    this.root.append(this.pauseButton);

    this.goalBanner = document.createElement("div");
    this.goalBanner.className = "goal-banner hidden";
    this.root.append(this.goalBanner);

    this.powerupBanner = document.createElement("div");
    this.powerupBanner.className = "powerup-banner hidden";
    this.root.append(this.powerupBanner);

    this.blindOverlay = document.createElement("div");
    this.blindOverlay.className = "blind-overlay hidden";
    this.root.append(this.blindOverlay);
  }

  setMode(mode) {
    if (mode === "ai") {
      this.modeElement.textContent = "Mode: 1P vs AI";
      return;
    }
    if (mode === "ai-vs-ai") {
      this.modeElement.textContent = "Mode: AI vs AI";
      return;
    }
    if (mode === "two-player") {
      this.modeElement.textContent = "Mode: Mobile 2P";
      return;
    }
    this.modeElement.textContent = `Mode: ${mode}`;
  }

  setScore(playerScore, opponentScore) {
    this.scoreElement.textContent = `${playerScore} : ${opponentScore}`;
  }

  setStatus(text) {
    this.statusElement.textContent = text;
  }

  setPauseHandler(handler) {
    this.onPause = handler;
  }

  setPauseButtonEnabled(enabled) {
    this.pauseButton.disabled = !enabled;
  }

  setPauseButtonLabel(label) {
    this.pauseButton.textContent = label;
  }

  showGoalBanner(text, side) {
    this.goalBanner.textContent = text;
    this.goalBanner.classList.remove("hidden", "player", "opponent");
    this.goalBanner.classList.add(side === "player" ? "player" : "opponent");
  }

  hideGoalBanner() {
    this.goalBanner.classList.add("hidden");
  }

  showPowerupBanner(text, side) {
    this.powerupBanner.textContent = text;
    this.powerupBanner.classList.remove("hidden", "player", "opponent");
    if (side === "player" || side === "opponent") {
      this.powerupBanner.classList.add(side);
    }

    if (this.powerupBannerTimeout) {
      clearTimeout(this.powerupBannerTimeout);
    }
    this.powerupBannerTimeout = setTimeout(() => {
      this.powerupBanner.classList.add("hidden");
    }, 1800);
  }

  hidePowerupBanner() {
    if (this.powerupBannerTimeout) {
      clearTimeout(this.powerupBannerTimeout);
      this.powerupBannerTimeout = null;
    }
    this.powerupBanner.classList.add("hidden");
  }

  setBlindOverlayVisible(visible) {
    this.blindOverlay.classList.toggle("hidden", !visible);
  }
}
