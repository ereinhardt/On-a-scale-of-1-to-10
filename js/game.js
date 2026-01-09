import {
  revealAnimation,
  resetNumberDisplays,
  resetContainerOrder,
} from "./reveal.js";

export const FOR_REVEAL_PAUSE_MS = 3000;
export const AFTER_REVEAL_PAUSE_MS = 3000;

export const GAME_STATE = Object.freeze({
  STARTED: 0,
  READY: 1,
  ROLLING: 2,
  SELECT_IMAGE: 3,
  REVEAL_PAUSE: 4,
  REVEALING: 5,
});

function serializeBoard(board) {
  return board
    .filter((field) => field && field.image && field.image.image)
    .map((field) => {
      const imagePath = field.image.image.getAttribute("src");
      return {
        image: imagePath
          .replace(/__(1024|512|256)__/, "__**__")
          .split("/")
          .pop(),
        index: field.index + 1,
      };
    });
}

export class Field {
  constructor(image, index) {
    this.image = image;
    this.index = index;
  }
}

export default class Game {
  constructor() {
    this.state = GAME_STATE.STARTED;
    this.currentImage = null;
    this.board = [];
    this.picPerRound = 10;
    this.placesSelected = 0;
    this.onImagePlacedCallback = null;
    this.revealSequenceId = 0; // ID to identify current reveal sequence
    this.enable_selection();
    this.updateBodyState();
  }

  onImagePlaced(callback) {
    this.onImagePlacedCallback = callback;
  }

  updateBodyState() {
    const stateClasses = {
      [GAME_STATE.STARTED]: "state-started",
      [GAME_STATE.READY]: "state-ready",
      [GAME_STATE.ROLLING]: "state-rolling",
      [GAME_STATE.SELECT_IMAGE]: "state-select-image",
      [GAME_STATE.REVEAL_PAUSE]: "state-reveal-pause",
      [GAME_STATE.REVEALING]: "state-revealing",
    };

    const body = document.body;
    body.classList.remove(...Object.values(stateClasses));
    body.classList.add(stateClasses[this.state]);
  }

  enable_selection() {
    const fields = Array.from(document.getElementsByClassName("item-box"));
    for (const field of fields) {
      field.addEventListener("click", (e) => {
        const container = field.closest(".item-box-container");
        const index = parseInt(container.dataset.index, 10);
        if (this.state == GAME_STATE.SELECT_IMAGE && !this.board[index]) {
          if (!this.currentImage || !this.currentImage.image) {
            return;
          }
          this.placesSelected++;

          this.board[index] = new Field(this.currentImage, index);

          if (this.onImagePlacedCallback) {
            this.onImagePlacedCallback(this.currentImage);
          }

          // Find the correct num element based on the container
          const num = container.querySelector(".item-box-number");

          num.classList.remove("animate_number_reverse");
          num.classList.add("animate_number");

          field.appendChild(this.currentImage.image.cloneNode());

          if (this.placesSelected == this.picPerRound) {
            this.startRevealSequence();
            return;
          }

          this.select_image();
        }
      });
    }
  }

  start_rolling() {
    this.state = GAME_STATE.ROLLING;
    this.updateBodyState();
  }

  stop_rolling() {
    this.state = GAME_STATE.SELECT_IMAGE;
    this.updateBodyState();
  }

  async startRevealSequence() {
    // Switch to reveal-pause state ("Thank you for your input")
    this.state = GAME_STATE.REVEAL_PAUSE;
    this.updateBodyState();

    // Remember current sequence ID
    const currentSequenceId = ++this.revealSequenceId;

    if (this.board.length > 2) {
      await this.sendGameData();
    }

    // Check if this sequence is still valid
    if (this.revealSequenceId !== currentSequenceId) return;

    // Short pause before reveal starts
    await new Promise((resolve) => setTimeout(resolve, FOR_REVEAL_PAUSE_MS));

    // Check if this sequence is still valid
    if (this.revealSequenceId !== currentSequenceId) return;

    // Switch to revealing state ("Reveal Global Average")
    this.state = GAME_STATE.REVEALING;
    this.updateBodyState();

    await revealAnimation(this.board);

    // Check if this sequence is still valid
    if (this.revealSequenceId !== currentSequenceId) return;

    await new Promise((resolve) => setTimeout(resolve, AFTER_REVEAL_PAUSE_MS));

    if (this.revealSequenceId !== currentSequenceId) return;

    this.reset();
  }

  async reset() {
    // Invalidate running reveal sequences
    this.revealSequenceId++;

    this.state = GAME_STATE.STARTED;
    this.updateBodyState();
    this.currentImage = null;
    this.placesSelected = 0;
    this.board = [];

    const fields = Array.from(document.getElementsByClassName("item-box"));
    const nums = Array.from(document.getElementsByClassName("item-box-number"));

    // Start animations first (number back + image fade out)
    fields.forEach((field, i) => {
      const img = field.querySelector("img");
      if (img) {
        nums[i].classList.remove("animate_number");
        nums[i].classList.add("animate_number_reverse");
        img.classList.add("fade-out");
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Remove images and reset numbers
    fields.forEach((field) => {
      const img = field.querySelector("img");
      if (img) {
        img.remove();
      }
    });

    resetContainerOrder();

    resetNumberDisplays();
  }

  async sendGameData() {
    const gameData = JSON.stringify(serializeBoard(this.board));
    const res = await fetch("backend/receive-global-average.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: gameData,
    });

    if (!res.ok) {
      throw new Error("Failed to send game data: " + res.statusText);
    }
  }

  select_image() {
    this.state = GAME_STATE.READY;
    this.updateBodyState();
  }
}
