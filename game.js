
export const GAME_STATE = Object.freeze({
    READY: 1,
    ROLLING: 2,
    SELECT_IMAGE: 3
})

export class Field {
    constructor(image, index) {
        this.image = image, 
        this.index = index;
    }

    setImage(img){
        this.image = img;
    }
}


export default class Game {

    constructor(){
        this.state = GAME_STATE.READY;
        this.lastSelected = null;
        this.currentImage = null;
        this.board = [];
    }

    start_rolling(){
        this.currentImage = null;
        this.state = GAME_STATE.ROLLING;
    }

    stop_rolling() {
        this.state = GAME_STATE.SELECT_IMAGE;
    }

    select_image() {
        this.lastSelected = this.currentImage;
        this.state = GAME_STATE.READY;
    }
}