import * as PIXI from 'pixi.js-legacy';
import { InteractiveDisplayObject } from '../types';
import { SkiaRenderer } from '../skia/SkiaRenderer';

export class SceneManager {
    private app: PIXI.Application | null = null;
    private container: HTMLElement;
    private scenes: PIXI.Container[] = [];
    private currentSceneIndex: number = 0;
    private autoSwitchInterval: any = null;

    private skiaRenderer: SkiaRenderer | null = null;
    private updateLoopId: number | null = null;

    private selectedObject: InteractiveDisplayObject | null = null;
    private isDragging: boolean = false;
    private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private objectStartPos: { x: number; y: number } = { x: 0, y: 0 };

    private selectionBox: PIXI.Graphics | null = null;

    constructor(container: HTMLElement, skiaRenderer?: SkiaRenderer) {
        this.container = container;
        this.skiaRenderer = skiaRenderer || null;
        this.initPixi();
    }

    public setSkiaRenderer(renderer: SkiaRenderer): void {
        this.skiaRenderer = renderer;
        if (!this.updateLoopId) {
            this.startUpdateLoop();
        }
    }

    private updateSkia(): void {
        if (!this.skiaRenderer) return;

        const container = this.getCurrentContainer();
        if (container) {
            this.skiaRenderer.renderContainer(container);
        }
    }

    private initPixi(): void {
        this.app = new PIXI.Application({
            width: 800,
            height: 600,
            backgroundAlpha: 1,
            backgroundColor: 0xffffff,
            forceCanvas: true,
            autoSort: false,
            preserveDrawingBuffer: true,
            antialias: false,
            resolution: 1,
            eventMode: 'static',
            eventFeatures: {
                move: true,
                globalMove: true,
                click: true,
                wheel: true,
            },
        });

        const canvasElement = (this.app as any).view || (this.app as any).canvas;
        if (canvasElement && this.container) {
            this.container.appendChild(canvasElement);
        }

        this.createScenes();
        this.setupDragEvents();
        this.startUpdateLoop();
    }

    private startUpdateLoop(): void {
        if (this.updateLoopId) return;

        const update = () => {
            if (this.skiaRenderer) {
                this.updateSkia();
            }
            this.updateLoopId = requestAnimationFrame(update);
        };

        this.updateLoopId = requestAnimationFrame(update);
    }

    private stopUpdateLoop(): void {
        if (this.updateLoopId) {
            cancelAnimationFrame(this.updateLoopId);
            this.updateLoopId = null;
        }
    }

    private setupDragEvents(): void {
        if (!this.app) return;

        const stage = this.app.stage;
        stage.eventMode = 'static';
        stage.hitArea = new PIXI.Rectangle(0, 0, 800, 600);

        stage.on('pointerdown', (event: any) => {
            const pos = event.data.global;
            const hitObject = this.findObjectAtPoint(pos.x, pos.y);

            if (hitObject) {
                this.selectedObject = hitObject;
                this.isDragging = true;
                this.dragStartPos = { x: pos.x, y: pos.y };
                this.objectStartPos = {
                    x: hitObject.position.x,
                    y: hitObject.position.y
                };
            }
        });

        stage.on('pointermove', (event: any) => {
            if (this.isDragging && this.selectedObject) {
                const pos = event.data.global;

                this.selectedObject.position.set(
                    this.objectStartPos.x + (pos.x - this.dragStartPos.x),
                    this.objectStartPos.y + (pos.y - this.dragStartPos.y)
                );
            }
        });

        stage.on('pointerup', () => {
            this.isDragging = false;
        });
    }

    private findObjectAtPoint(x: number, y: number): InteractiveDisplayObject | null {
        const scene = this.getCurrentContainer();

        for (let i = scene.children.length - 1; i >= 0; i--) {
            const child = scene.children[i] as any;

            if (child === this.selectionBox) continue;

            if (child.type === 'graphics' || child.type === 'sprite') {
                const bounds = child.getBounds();
                if (x >= bounds.x && x <= bounds.x + bounds.width &&
                    y >= bounds.y && y <= bounds.y + bounds.height) {
                    return child;
                }
            }
        }

        return null;
    }

    private createScenes(): void {
        for (let i = 0; i < 3; i++) {
            const scene = new PIXI.Container();
            scene.visible = (i === 0);
            this.scenes.push(scene);
            this.app?.stage.addChild(scene);
        }

        this.buildDefaultScene(this.scenes[0]);
    }

    private buildDefaultScene(mainContainer: PIXI.Container): void {
        const ellipse = new PIXI.Graphics() as InteractiveDisplayObject;
        ellipse.beginFill(0xff0000);
        ellipse.drawEllipse(0, 0, 100, 50);
        ellipse.endFill();
        ellipse.position.set(150, 100);
        ellipse.angle = 30;
        ellipse.eventMode = 'static';
        ellipse.type = 'graphics';

        const rect = new PIXI.Graphics() as InteractiveDisplayObject;
        rect.beginFill(0x0000ff);
        rect.drawRect(0, 0, 100, 150);
        rect.endFill();
        rect.position.set(400, 200);
        rect.angle = 15;
        rect.scale.set(1.5, 1.7);
        rect.eventMode = 'static';
        rect.type = 'graphics';

        const circle = new PIXI.Graphics() as InteractiveDisplayObject;
        circle.beginFill(0x00ff00);
        circle.drawCircle(0, 0, 60);
        circle.endFill();
        circle.position.set(650, 150);
        circle.eventMode = 'static';
        circle.type = 'graphics';

        const triangle = new PIXI.Graphics() as InteractiveDisplayObject;
        triangle.beginFill(0xffff00);
        triangle.moveTo(0, -50);
        triangle.lineTo(50, 50);
        triangle.lineTo(-50, 50);
        triangle.closePath();
        triangle.endFill();
        triangle.position.set(300, 400);
        triangle.angle = -10;
        triangle.eventMode = 'static';
        triangle.type = 'graphics';

        const star = new PIXI.Graphics() as InteractiveDisplayObject;
        star.beginFill(0xff8800);
        const points = 5;
        const outerRadius = 50;
        const innerRadius = 25;
        const starAngle = -Math.PI / 2;

        star.moveTo(
            Math.cos(starAngle) * outerRadius,
            Math.sin(starAngle) * outerRadius
        );

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? innerRadius : outerRadius;
            const angle = starAngle + (i * Math.PI) / points;
            star.lineTo(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );
        }

        star.closePath();
        star.endFill();
        star.position.set(550, 400);
        star.angle = 15;
        star.eventMode = 'static';
        star.type = 'graphics';

        const semiRect = new PIXI.Graphics() as InteractiveDisplayObject;
        semiRect.beginFill(0x00ffff, 0.5);
        semiRect.lineStyle(3, 0x0066cc, 1);
        semiRect.drawRect(0, 0, 120, 80);
        semiRect.endFill();
        semiRect.position.set(50, 50);
        semiRect.eventMode = 'static';
        semiRect.type = 'graphics';

        const arc = new PIXI.Graphics() as InteractiveDisplayObject;
        arc.beginFill(0xff66aa, 0.8);
        arc.moveTo(0, 0);
        arc.arc(0, 0, 70, 0, Math.PI * 1.5);
        arc.lineTo(0, 0);
        arc.closePath();
        arc.endFill();
        arc.position.set(650, 500);
        arc.angle = 45;
        arc.eventMode = 'static';
        arc.type = 'graphics';

        const groupContainer = new PIXI.Container();
        groupContainer.position.set(500, 250);
        (groupContainer as InteractiveDisplayObject).type = 'container';

        const smallSquare = new PIXI.Graphics() as InteractiveDisplayObject;
        smallSquare.beginFill(0x993399);
        smallSquare.drawRect(-20, -20, 40, 40);
        smallSquare.endFill();
        smallSquare.eventMode = 'static';
        smallSquare.type = 'graphics';

        const smallCircle = new PIXI.Graphics() as InteractiveDisplayObject;
        smallCircle.beginFill(0x339933);
        smallCircle.drawCircle(30, 30, 20);
        smallCircle.endFill();
        smallCircle.eventMode = 'static';
        smallCircle.type = 'graphics';

        const smallLine = new PIXI.Graphics() as InteractiveDisplayObject;
        smallLine.lineStyle(3, 0xff9933, 1);
        smallLine.moveTo(-10, -30);
        smallLine.lineTo(40, -30);
        smallLine.eventMode = 'static';
        smallLine.type = 'graphics';

        groupContainer.addChild(smallSquare, smallCircle, smallLine);

        mainContainer.addChild(
            semiRect,
            ellipse,
            rect,
            circle,
            triangle,
            star,
            arc,
            groupContainer
        );
    }

    public getCurrentContainer(): PIXI.Container {
        return this.scenes[this.currentSceneIndex];
    }

    public async addSpriteWithImage(url: string, x: number = 0, y: number = 0): Promise<void> {
        if (!this.app) return;

        try {
            const texture = await PIXI.Assets.load(url);
            const pixiSprite = new PIXI.Sprite(texture);
            pixiSprite.position.set(x, y);
            pixiSprite.eventMode = 'static';
            (pixiSprite as any).type = 'sprite';

            const canvasKit = (window as any).canvasKit;
            if (canvasKit) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const arrayBuffer = await response.blob().then(blob => blob.arrayBuffer());
                    const skiaImage = canvasKit.MakeImageFromEncoded(new Uint8Array(arrayBuffer));
                    if (skiaImage) {
                        (pixiSprite as any).skiaImage = skiaImage;
                    }
                } catch (skiaError) {
                    console.error('[SceneManager] Ошибка загрузки для Skia:', skiaError);
                }
            }

            const currentScene = this.getCurrentContainer();
            if (currentScene) {
                currentScene.addChild(pixiSprite);
            }
        } catch (error) {
            console.error('[SceneManager] Ошибка при добавлении спрайта:', error);
            throw error;
        }
    }

    public addRandomShape(): void {
        const graphics = new PIXI.Graphics();
        const color = Math.floor(Math.random() * 0xFFFFFF);
        graphics.beginFill(color);
        graphics.drawRect(0, 0, 50 + Math.random() * 100, 50 + Math.random() * 100);
        graphics.endFill();
        graphics.position.set(Math.random() * 600, Math.random() * 400);
        graphics.eventMode = 'static';
        (graphics as any).type = 'graphics';
        this.getCurrentContainer().addChild(graphics);
    }

    public switchScene(): void {
        this.scenes[this.currentSceneIndex].visible = false;
        this.currentSceneIndex = (this.currentSceneIndex + 1) % this.scenes.length;
        this.scenes[this.currentSceneIndex].visible = true;
        this.selectedObject = null;
        if (this.selectionBox) {
            this.selectionBox.destroy();
            this.selectionBox = null;
        }
    }

    public clearScene(): void {
        const scene = this.getCurrentContainer();
        for (let i = scene.children.length - 1; i >= 0; i--) {
            const child = scene.children[i] as any;
            if (child.skiaImage && typeof child.skiaImage.delete === 'function') {
                child.skiaImage.delete();
            }
        }
        scene.removeChildren();
        this.selectedObject = null;
        if (this.selectionBox) {
            this.selectionBox.destroy();
            this.selectionBox = null;
        }
    }

    public toggleAutoSwitch(): boolean {
        if (this.autoSwitchInterval) {
            clearInterval(this.autoSwitchInterval);
            this.autoSwitchInterval = null;
            return false;
        } else {
            this.autoSwitchInterval = setInterval(() => this.switchScene(), 3000);
            return true;
        }
    }

    public resetScene(): void {
        this.clearScene();
        this.buildDefaultScene(this.getCurrentContainer());
    }

    public dispose(): void {
        this.stopUpdateLoop();

        if (this.autoSwitchInterval) {
            clearInterval(this.autoSwitchInterval);
        }

        if (this.app) {
            this.app.destroy(true);
            this.app = null;
        }
    }
}