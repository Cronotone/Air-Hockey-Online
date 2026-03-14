export class StartMenu {
  constructor(root) {
    this.root = root;
    this.onStart = null;
    this.isMobileInput =
      typeof window !== "undefined" &&
      (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

    this.overlay = document.createElement("div");
    this.overlay.className = "menu-overlay";

    const card = document.createElement("div");
    card.className = "menu-card";

    this.titleElement = document.createElement("h1");
    this.titleElement.className = "menu-title";
    this.titleElement.textContent = "3D Air Hockey Finals";

    this.subtitleElement = document.createElement("p");
    this.subtitleElement.className = "menu-subtitle";
    this.subtitleElement.textContent = "Choose a mode";

    this.resultElement = document.createElement("p");
    this.resultElement.className = "menu-result hidden";

    this.modeButtons = document.createElement("div");
    this.modeButtons.className = "menu-buttons";

    const startButton = this.createButton("Start 1P vs AI");
    startButton.addEventListener("click", () => this.handleStart("ai"));

    const twoPlayerButton = this.createButton("Start Mobile 2P");
    twoPlayerButton.addEventListener("click", () => this.handleStart("two-player"));
    if (!this.isMobileInput) {
      twoPlayerButton.disabled = true;
      twoPlayerButton.textContent = "Start Mobile 2P (Phone Only)";
    }

    const watchButton = this.createButton("Watch AI vs AI");
    watchButton.addEventListener("click", () => this.showBetting());
    this.modeButtons.append(startButton, twoPlayerButton, watchButton);

    this.bettingButtons = document.createElement("div");
    this.bettingButtons.className = "menu-bet-buttons hidden";

    const bettingNote = document.createElement("p");
    bettingNote.className = "menu-bet-note";
    bettingNote.textContent = "Pick your winner before kickoff";

    const betBlueButton = this.createButton("Bet Blue AI");
    betBlueButton.addEventListener("click", () => this.handleStart("ai-vs-ai", "player"));

    const betOrangeButton = this.createButton("Bet Orange AI");
    betOrangeButton.addEventListener("click", () => this.handleStart("ai-vs-ai", "opponent"));

    const backButton = this.createButton("Back");
    backButton.addEventListener("click", () => this.showModeSelection());

    this.bettingButtons.append(bettingNote, betBlueButton, betOrangeButton, backButton);

    this.helpElement = document.createElement("p");
    this.helpElement.className = "menu-help";
    this.helpElement.textContent =
      "1P vs AI: touch or mouse controls your striker. Mobile 2P: each side controls their own striker on one phone/tablet. AI vs AI: camera moves to the side and you must place a bet. First to 7 wins.";

    card.append(
      this.titleElement,
      this.subtitleElement,
      this.resultElement,
      this.modeButtons,
      this.bettingButtons,
      this.helpElement
    );
    this.overlay.append(card);
    this.root.append(this.overlay);
  }

  createButton(label) {
    const button = document.createElement("button");
    button.className = "menu-button";
    button.type = "button";
    button.textContent = label;
    return button;
  }

  showBetting() {
    this.subtitleElement.textContent = "AI vs AI: place your bet";
    this.modeButtons.classList.add("hidden");
    this.bettingButtons.classList.remove("hidden");
  }

  showModeSelection() {
    this.subtitleElement.textContent = "Choose a mode";
    this.modeButtons.classList.remove("hidden");
    this.bettingButtons.classList.add("hidden");
  }

  handleStart(mode, betSide = null) {
    if (typeof this.onStart === "function") {
      this.onStart({ mode, betSide });
    }
  }

  show(onStart) {
    this.onStart = onStart;
    this.titleElement.textContent = "3D Air Hockey Finals";
    this.resultElement.textContent = "";
    this.resultElement.classList.add("hidden");
    this.showModeSelection();
    this.overlay.classList.remove("hidden");
  }

  showGameOver(winnerLabel, onStart, resultText = "") {
    this.onStart = onStart;
    this.titleElement.textContent = `${winnerLabel} Wins`;
    this.resultElement.textContent = resultText;
    this.resultElement.classList.toggle("hidden", !resultText);
    this.showModeSelection();
    this.overlay.classList.remove("hidden");
  }

  hide() {
    this.overlay.classList.add("hidden");
  }

  isVisible() {
    return !this.overlay.classList.contains("hidden");
  }
}
