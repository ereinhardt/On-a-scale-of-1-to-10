
export const GAME_STATE = Object.freeze({
    STARTED: 0,
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
        this.state = GAME_STATE.STARTED;
        this.lastSelected = null;
        this.currentImage = null;
        this.board = [];
        this.picPerRound = 10;
        this.placesSelected = 0;
        this.lastBoard = [];
        this.enable_selection();
    }

    enable_selection(){
        console.log("enable selection");
        const fields = Array.from(document.getElementsByClassName("item-box"));
        for(const field of fields) {
            console.log(field);
            field.addEventListener("click", (e) => {
                
                const index = fields.indexOf(field);
                console.log("Selected Field: " + index );
                if(this.state == GAME_STATE.SELECT_IMAGE && !this.board[index]) {

                    this.placesSelected++;


                   this.board[index] = new Field(this.currentImage, index);
                   const num = document.getElementsByClassName("item-box-number")[index];
                   
                   num.classList.remove("animate_number_reverse");
                   num.classList.add("animate_number");

                    field.appendChild(this.currentImage.image.cloneNode());

                    if(this.placesSelected == this.picPerRound) {
                            setTimeout(() => {
                                this.reset();
                            }, 300)

                            console.log("Reset");
                          
                            return;
                    }


                    this.select_image()
                }
            })
        }

    }

    start_rolling(){
        this.currentImage = null;
        this.state = GAME_STATE.ROLLING;
    }

    stop_rolling() {
        this.state = GAME_STATE.SELECT_IMAGE;
    }

    reset() {
        this.state = GAME_STATE.STARTED;
        this.lastSelected = null;
        this.currentImage = null;
        this.placesSelected = 0;
        this.lastBoard = this.board;
        this.board = [];

        const fields = Array.from(document.getElementsByClassName("item-box"));

        let i = 0;
        const nums = Array.from(document.getElementsByClassName("item-box-number"));


        for(const field of fields) {
            if(field.firstChild && field.firstChild.nodeName === "IMG") {
                nums[i].classList.remove("animate_number");
                nums[i].classList.add("animate_number_reverse");
                field.firstChild.remove();
            };


            i++;
        }


    }

    select_image() {
        this.lastSelected = this.currentImage;
        this.state = GAME_STATE.READY;
    }
}