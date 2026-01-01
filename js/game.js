import {
  revealAnimation,
  resetNumberDisplays,
  resetContainerOrder,
} from "./reveal.js";

// Konstanten
export const FOR_REVEAL_PAUSE_MS = 1000; // Pause vor der Reveal-Animation (in Millisekunden)
export const AFTER_REVEAL_PAUSE_MS = 3000; // Pause nach der Reveal-Animation (in Millisekunden)

export const GAME_STATE = Object.freeze({
  STARTED: 0,
  READY: 1,
  ROLLING: 2,
  SELECT_IMAGE: 3,
  REVEALING: 4,
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
    this.revealSequenceId = 0; // ID zur Identifikation der aktuellen Reveal-Sequenz
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

          // Finde das richtige num-Element basierend auf dem Container
          const num = container.querySelector(".item-box-number");

          num.classList.remove("animate_number_reverse");
          num.classList.add("animate_number");

          field.appendChild(this.currentImage.image.cloneNode());

          if (this.placesSelected == this.picPerRound) {
            // Starte die Reveal-Sequenz
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
    // Wechsle zum Revealing-State
    this.state = GAME_STATE.REVEALING;
    this.updateBodyState();

    // Merke die aktuelle Sequenz-ID
    const currentSequenceId = ++this.revealSequenceId;

    // Sende zuerst die Spieldaten
    if (this.board.length > 2) {
      await this.sendGameData();
    }

    // Prüfe ob diese Sequenz noch gültig ist
    if (this.revealSequenceId !== currentSequenceId) return;

    // Kurze Pause bevor Reveal startet
    await new Promise((resolve) => setTimeout(resolve, FOR_REVEAL_PAUSE_MS));

    // Prüfe ob diese Sequenz noch gültig ist
    if (this.revealSequenceId !== currentSequenceId) return;

    // Führe die Reveal-Animation durch
    await revealAnimation(this.board);

    // Prüfe ob diese Sequenz noch gültig ist
    if (this.revealSequenceId !== currentSequenceId) return;

    // Pause nach der Animation, bevor das Spiel zurückgesetzt wird
    await new Promise((resolve) => setTimeout(resolve, AFTER_REVEAL_PAUSE_MS));

    // Prüfe ob diese Sequenz noch gültig ist
    if (this.revealSequenceId !== currentSequenceId) return;

    // Nach der Animation: Reset
    this.reset();
  }

  async reset() {
    // Invalidiere laufende Reveal-Sequenzen
    this.revealSequenceId++;
    
    this.state = GAME_STATE.STARTED;
    this.updateBodyState();
    this.currentImage = null;
    this.placesSelected = 0;
    this.board = [];

    const fields = Array.from(document.getElementsByClassName("item-box"));
    const nums = Array.from(document.getElementsByClassName("item-box-number"));

    // Erst die Animationen starten (Zahl zurück + Bild ausblenden)
    fields.forEach((field, i) => {
      const img = field.querySelector("img");
      if (img) {
        nums[i].classList.remove("animate_number");
        nums[i].classList.add("animate_number_reverse");
        img.classList.add("fade-out");
      }
    });

    // Warten bis Animation fertig
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Bilder entfernen und Nummern zurücksetzen
    fields.forEach((field) => {
      const img = field.querySelector("img");
      if (img) {
        img.remove();
      }
    });

    // Setze die DOM-Reihenfolge der Container zurück (wichtig für Event-Listener)
    resetContainerOrder();

    // Setze die Nummern-Anzeige zurück auf 1-10
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
