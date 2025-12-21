export const GAME_STATE = Object.freeze({
  STARTED: 0,
  READY: 1,
  ROLLING: 2,
  SELECT_IMAGE: 3,
});

class GameSerializer {
  constructor(board) {
    this.game = [];

    board.forEach((field) => {
      if (field && field.image && field.image.image) {
        let imagePath = field.image.image.getAttribute("src");

        this.game.push({
          image: imagePath
            .replace(/(1024)|(512)|(256)/, "**")
            .split("/")
            .pop(), // Only filename, no path
          index: field.index,
        });
      }
    });
  }
}

export class Field {
  constructor(image, index) {
    (this.image = image), (this.index = index);
  }

  setImage(img) {
    this.image = img;
  }
}

export default class Game {
  constructor() {
    this.state = GAME_STATE.STARTED;
    this.lastSelected = null;
    this.currentImage = null;
    this.board = [];
    this.picPerRound = 10;
    this.placesSelected = 0;
    this.lastBoard = [];
    this.enable_selection();
    this.updateBodyState();
  }

  updateBodyState() {
    const body = document.body;
    body.classList.remove(
      "state-started",
      "state-ready",
      "state-rolling",
      "state-select-image"
    );

    switch (this.state) {
      case GAME_STATE.STARTED:
        body.classList.add("state-started");
        break;
      case GAME_STATE.READY:
        body.classList.add("state-ready");
        break;
      case GAME_STATE.ROLLING:
        body.classList.add("state-rolling");
        break;
      case GAME_STATE.SELECT_IMAGE:
        body.classList.add("state-select-image");
        break;
    }
  }

  enable_selection() {
    //console.log("enable selection");
    const fields = Array.from(document.getElementsByClassName("item-box"));
    for (const field of fields) {
      //console.log(field);
      field.addEventListener("click", (e) => {
        const index = fields.indexOf(field);
        //console.log("Selected Field: " + index );
        if (this.state == GAME_STATE.SELECT_IMAGE && !this.board[index]) {
          this.placesSelected++;

          this.board[index] = new Field(this.currentImage, index);
          const num = document.getElementsByClassName("item-box-number")[index];

          num.classList.remove("animate_number_reverse");
          num.classList.add("animate_number");

          field.appendChild(this.currentImage.image.cloneNode());

          if (this.placesSelected == this.picPerRound) {
            setTimeout(() => {
              this.reset();
            }, 300);

            console.log("Reset");

            return;
          }

          this.select_image();
        }
      });
    }
  }

  start_rolling() {
    this.currentImage = null;
    this.state = GAME_STATE.ROLLING;
    this.updateBodyState();
  }

  stop_rolling() {
    this.state = GAME_STATE.SELECT_IMAGE;
    this.updateBodyState();
  }

  async reset() {
    this.state = GAME_STATE.STARTED;
    this.updateBodyState();
    this.lastSelected = null;
    this.currentImage = null;
    this.placesSelected = 0;
    this.lastBoard = this.board;

    console.log("BoardLength:", this.board.length);

    if (this.board.length > 2) {
      await this.sendGameData();
    }

    this.board = [];
    let i = 0;
    const fields = Array.from(document.getElementsByClassName("item-box"));
    const nums = Array.from(document.getElementsByClassName("item-box-number"));

    for (const field of fields) {
      if (field.firstChild && field.firstChild.nodeName === "IMG") {
        nums[i].classList.remove("animate_number");
        nums[i].classList.add("animate_number_reverse");
        field.firstChild.remove();
      }

      i++;
    }
  }

  async sendGameData() {
    const serializer = new GameSerializer(this.board);
    const gameData = JSON.stringify(serializer.game);
    console.log("Sending game data:", gameData);
    const res = await fetch("backend/receive-global-average.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: gameData,
    });

    console.log("Response:", res);

    if (!res.ok) {
      throw new Error("Failed to send game data: " + res.statusText);
    }
  }

  select_image() {
    this.lastSelected = this.currentImage;
    this.state = GAME_STATE.READY;
    this.updateBodyState();
  }
}
