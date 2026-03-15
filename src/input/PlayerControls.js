const pressed = new Set();
let listenersBound = false;

function bindListeners() {
  if (listenersBound) {
    return;
  }
  listenersBound = true;

  window.addEventListener("keydown", (event) => {
    pressed.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    pressed.delete(event.code);
  });

  window.addEventListener("blur", () => {
    pressed.clear();
  });
}

export class PlayerControls {
  constructor(leftKey, rightKey, speed) {
    bindListeners();
    this.leftKey = leftKey;
    this.rightKey = rightKey;
    this.speed = speed;
  }

  getAxis() {
    const left = pressed.has(this.leftKey) ? -1 : 0;
    const right = pressed.has(this.rightKey) ? 1 : 0;
    return left + right;
  }

  update(padel, dt) {
    const direction = this.getAxis();
    if (direction === 0) {
      return;
    }
    padel.mesh.position.x += direction * this.speed * dt;
  }
}
