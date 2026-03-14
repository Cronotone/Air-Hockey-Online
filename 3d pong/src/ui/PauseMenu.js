export class PauseMenu {
  constructor(root) {
    this.root = root;
    this.onResume = null;
    this.onMainMenu = null;
    this.onPowerupsToggle = null;
    this.powerupsEnabled = true;

    this.overlay = document.createElement("div");
    this.overlay.className = "pause-overlay hidden";

    const card = document.createElement("div");
    card.className = "pause-card";

    const title = document.createElement("h2");
    title.className = "pause-title";
    title.textContent = "Paused";

    this.mainActions = document.createElement("div");
    this.mainActions.className = "pause-actions";

    this.resumeButton = this.createButton("Resume");
    this.optionsButton = this.createButton("Options");
    this.mainMenuButton = this.createButton("Main Menu");

    this.resumeButton.addEventListener("click", () => {
      if (typeof this.onResume === "function") {
        this.onResume();
      }
    });

    this.mainMenuButton.addEventListener("click", () => {
      if (typeof this.onMainMenu === "function") {
        this.onMainMenu();
      }
    });

    this.optionsButton.addEventListener("click", () => {
      this.showOptions();
    });

    this.mainActions.append(this.resumeButton, this.optionsButton, this.mainMenuButton);

    this.optionsPanel = document.createElement("div");
    this.optionsPanel.className = "pause-options hidden";

    const optionsHeader = document.createElement("p");
    optionsHeader.className = "pause-options-title";
    optionsHeader.textContent = "Options";

    const optionRow = document.createElement("div");
    optionRow.className = "pause-option-row";

    const optionLabel = document.createElement("span");
    optionLabel.textContent = "Touch or mouse controls striker (X and Z)";
    optionRow.append(optionLabel);

    const optionRow2 = document.createElement("div");
    optionRow2.className = "pause-option-row";
    optionRow2.textContent = "You are limited to your half of the table";

    const optionRow3 = document.createElement("div");
    optionRow3.className = "pause-option-row";
    const powerupsLabel = document.createElement("span");
    powerupsLabel.textContent = "Random powerups";
    this.powerupsToggleButton = this.createButton("ON");
    this.powerupsToggleButton.classList.add("pause-toggle-button");
    this.powerupsToggleButton.addEventListener("click", () => {
      this.setPowerupsEnabled(!this.powerupsEnabled);
      if (typeof this.onPowerupsToggle === "function") {
        this.onPowerupsToggle(this.powerupsEnabled);
      }
    });
    optionRow3.append(powerupsLabel, this.powerupsToggleButton);

    this.backButton = this.createButton("Back");
    this.backButton.addEventListener("click", () => {
      this.hideOptions();
    });

    this.optionsPanel.append(optionsHeader, optionRow, optionRow2, optionRow3, this.backButton);

    card.append(title, this.mainActions, this.optionsPanel);
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

  show() {
    this.hideOptions();
    this.overlay.classList.remove("hidden");
  }

  hide() {
    this.overlay.classList.add("hidden");
    this.hideOptions();
  }

  showOptions() {
    this.mainActions.classList.add("hidden");
    this.optionsPanel.classList.remove("hidden");
  }

  hideOptions() {
    this.optionsPanel.classList.add("hidden");
    this.mainActions.classList.remove("hidden");
  }

  setPowerupsEnabled(enabled) {
    this.powerupsEnabled = !!enabled;
    this.powerupsToggleButton.textContent = this.powerupsEnabled ? "ON" : "OFF";
    this.powerupsToggleButton.classList.toggle("off", !this.powerupsEnabled);
  }
}
