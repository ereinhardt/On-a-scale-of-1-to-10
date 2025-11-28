
export const GAME_STATE = Object.freeze({
    NOT_STARTED: 0,
    STARTED: 1,
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
        this.state = GAME_STATE.NOT_STARTED;
        this.lastSelected = null;
        this.currentImage = null;
        this.board = [];
    }

    start(){
        this.state = GAME_STATE.STARTED;
    }

    start_rolling(){
        this.state = GAME_STATE.ROLLING;
    }

    stop_rolling() {
        this.state = GAME_STATE.SELECT_IMAGE;
    }


    end(){
        this.state = GAME_STATE.NOT_STARTED;
    }
}