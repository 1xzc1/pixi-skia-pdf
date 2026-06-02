import * as PIXI from 'pixi.js';

export interface InteractiveDisplayObject extends PIXI.DisplayObject {
    type?: 'graphics' | 'sprite' | 'container';
    skiaImage?: any;
    _events?: {
        pointerdown?: Function | Function[];
        pointerup?: Function | Function[];
    };
}
