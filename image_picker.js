import { download_image } from "./util";


export class ImageItem {
    constructor(id, image) {
        this.id = id;
        this.image = image; 
    }
}


export default class ImagePicker{
    constructor(urls, queue_length, allready_inserted_cap) {
        this.urls = urls;

        if(this.urls.length < this.queue_length) throw Error("assert: this.urls < this.queue_length");

        this.queue_length = queue_length;
        this.queue = new Array(this.queue_length).fill(0);
        this.allreadyInsertedCap = allready_inserted_cap;
        this.cache = {};
    }

    //[12232424]

    allreadyInserted(id){
        
        let i = this.queue.length - 1;

        
        while(i >= this.queue.length - this.allreadyInsertedCap) {
            if(i < 0) break;
            currentItem = this.queue[i];
            i--;
            if(!(currentItem instanceof ImageItem)) continue;
            if(currentItem.id === id) return true;
        }

        return false;

    }

    getRandomItem(){
        
        let currentItem = this.urls;
        
        while(!(currentItem instanceof Array)){
            const keys = Object.keys(currentItem);
            const random_key_index = Math.floor(Math.random() * keys.length);
            const random_key = keys[random_key_index]
            currentItem = currentItem[random_key];
        }
        
        const random_index = Math.floor(Math.random() * currentItem.length);
        const url = url[random_index];

        return url;
    }

    getRandomUrl(){

        let random_url = this.getRandomItem();

        while(this.allreadyInserted(random_url)) {
                random_url = this.getRandomItem();
        }

        return random_url;
    }


    async init() {

        for (let index = 0; index < this.queue.length; index++) {
            const random_url = this.getRandomUrl();
            this.setImage(random_url, i);            
        }

    }

    async setImage(url, i) {

        let img;

        if(this.cache[url]) {
            img = this.cache[url];
        } else {
            img = await download_image(url);
            this.cache[url] = img;
        } 

        if(i < 0) {
            this.queue.push(
                new ImageItem(
                    url, 
                    img
                )
            )
        } else {
            this.queue[index] = new ImageItem(
                url,
                img
            );            
        }

    }


    nextImage(){

        const random_url = this.getRandomUrl();
        const new_image = this.queue.shift();
        this.setImage(random_url, -1);

        return new_image


    }

}