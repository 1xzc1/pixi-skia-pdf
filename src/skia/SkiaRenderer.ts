import { PDFExporter } from './SkiaPDFExporter';

export class SkiaRenderer {
    private canvasKit: any = null;
    private surface: any = null;
    private canvas: any = null;
    private htmlCanvas: HTMLCanvasElement | null = null;
    private isInitialized: boolean = false;
    private pdfExporter: PDFExporter | null = null;
    private lastRenderedContainer: any = null;

    private paintPool: Map<string, any> = new Map();
    private pathPool: any[] = [];

    private interactiveObjects: Map<string, any> = new Map();
    private hitTestCache: Map<string, any> = new Map();
    private currentHoverObject: any = null;
    private currentDragObject: any = null;
    private isDragging: boolean = false;
    private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private objectStartPos: { x: number; y: number } = { x: 0, y: 0 };

    private onObjectClick: ((obj: any) => void) | null = null;
    private onObjectHover: ((obj: any | null) => void) | null = null;
    private onObjectDrag: ((obj: any, dx: number, dy: number) => void) | null = null;

    private onChangeCallback: (() => void) | null = null;
    private autoUpdate: boolean = true;

    private logEventCallback: ((message: string) => void) | null = null;

    async initialize(htmlCanvas: HTMLCanvasElement): Promise<void> {
        if (!htmlCanvas) {
            throw new Error('HTML Canvas не предоставлен');
        }

        this.htmlCanvas = htmlCanvas;
        this.canvasKit = (window as any).canvasKit;

        if (!this.canvasKit) {
            throw new Error('CanvasKit не загружен');
        }

        try {
            if (this.canvasKit.MakeSWCanvasSurface) {
                this.surface = this.canvasKit.MakeSWCanvasSurface(htmlCanvas);
            } else if (this.canvasKit.MakeCanvasSurface) {
                this.surface = this.canvasKit.MakeCanvasSurface(htmlCanvas);
            } else if (this.canvasKit.MakeWebGLCanvasSurface) {
                this.surface = this.canvasKit.MakeWebGLCanvasSurface(htmlCanvas);
            } else {
                throw new Error('Нет доступного метода создания surface');
            }

            if (!this.surface) {
                throw new Error('Не удалось создать Skia surface');
            }

            this.canvas = this.surface.getCanvas();
            this.isInitialized = true;

            this.pdfExporter = new PDFExporter(this.canvasKit);

            this.setupInteractionEvents();

            this.log('Skia успешно инициализирован с поддержкой интерактивности');
        } catch (error) {
            this.log('Ошибка инициализации Skia: ' + error);
            throw error;
        }
    }

    public setLogEventCallback(callback: (message: string) => void): void {
        this.logEventCallback = callback;
    }

    private log(message: string): void {
        if (this.logEventCallback) {
            this.logEventCallback(message);
        }
    }

    private setupInteractionEvents(): void {
        if (!this.htmlCanvas) return;

        this.htmlCanvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.htmlCanvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.htmlCanvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.htmlCanvas.addEventListener('pointerleave', this.handlePointerLeave.bind(this));
        this.htmlCanvas.addEventListener('pointercancel', this.handlePointerUp.bind(this));

        this.htmlCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.htmlCanvas.style.touchAction = 'none';
        this.htmlCanvas.style.cursor = 'default';
    }

    private getCanvasPosition(event: PointerEvent): { x: number; y: number } {
        if (!this.htmlCanvas) return { x: 0, y: 0 };

        const rect = this.htmlCanvas.getBoundingClientRect();
        const scaleX = this.htmlCanvas.width / rect.width;
        const scaleY = this.htmlCanvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    private handlePointerDown(event: PointerEvent): void {
        const pos = this.getCanvasPosition(event);

        const hitObject = this.findObjectAtPosition(pos.x, pos.y);

        if (hitObject) {
            if (hitObject._events && hitObject._events.pointerdown) {
                this.emitPixiEvent(hitObject, 'pointerdown', event);
            }

            this.htmlCanvas?.setPointerCapture(event.pointerId);

            this.currentDragObject = hitObject;
            this.isDragging = true;
            this.dragStartPos = { x: pos.x, y: pos.y };
            this.objectStartPos = {
                x: hitObject.position?.x || 0,
                y: hitObject.position?.y || 0
            };

            if (this.onObjectClick) {
                this.onObjectClick(hitObject);
            }

            this.log(`Pointer down на объекте: ${hitObject.type || 'unknown'} в позиции (${pos.x}, ${pos.y})`);
        }
    }

    private handlePointerMove(event: PointerEvent): void {
        const pos = this.getCanvasPosition(event);

        const hitObject = this.findObjectAtPosition(pos.x, pos.y);

        if (this.currentHoverObject !== hitObject) {
            if (this.currentHoverObject) {
                if (this.currentHoverObject._events && this.currentHoverObject._events.pointerout) {
                    this.emitPixiEvent(this.currentHoverObject, 'pointerout', event);
                }
                this.htmlCanvas!.style.cursor = 'default';
            }

            if (hitObject) {
                if (hitObject._events && hitObject._events.pointerover) {
                    this.emitPixiEvent(hitObject, 'pointerover', event);
                }
                this.htmlCanvas!.style.cursor = 'pointer';

                if (this.onObjectHover) {
                    this.onObjectHover(hitObject);
                }
            } else {
                if (this.onObjectHover) {
                    this.onObjectHover(null);
                }
            }

            this.currentHoverObject = hitObject;
        }

        if (this.isDragging && this.currentDragObject) {
            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;

            if (this.currentDragObject.position) {
                this.currentDragObject.position.set(
                    this.objectStartPos.x + dx,
                    this.objectStartPos.y + dy
                );
            }

            if (this.currentDragObject._events && this.currentDragObject._events.pointermove) {
                this.emitPixiEvent(this.currentDragObject, 'pointermove', event);
            }

            if (this.onObjectDrag) {
                this.onObjectDrag(this.currentDragObject, dx, dy);
            }

            this.requestUpdate();
        }
    }

    private handlePointerUp(event: PointerEvent): void {
        const pos = this.getCanvasPosition(event);

        this.htmlCanvas?.releasePointerCapture(event.pointerId);

        if (this.isDragging && this.currentDragObject) {
            if (this.currentDragObject._events && this.currentDragObject._events.pointerup) {
                this.emitPixiEvent(this.currentDragObject, 'pointerup', event);
            }

            this.log(`Pointer up на объекте: ${this.currentDragObject.type || 'unknown'}`);

            this.isDragging = false;
            this.currentDragObject = null;
        }
    }

    private handlePointerLeave(event: PointerEvent): void {
        if (this.currentHoverObject) {
            if (this.currentHoverObject._events && this.currentHoverObject._events.pointerout) {
                this.emitPixiEvent(this.currentHoverObject, 'pointerout', event);
            }
            this.currentHoverObject = null;

            if (this.onObjectHover) {
                this.onObjectHover(null);
            }

            if (this.htmlCanvas) {
                this.htmlCanvas.style.cursor = 'default';
            }
        }
    }

    private emitPixiEvent(obj: any, eventType: string, originalEvent: PointerEvent): void {
        if (!obj._events || !obj._events[eventType]) return;

        const listeners = obj._events[eventType];

        const pixiEvent = {
            type: eventType,
            target: obj,
            currentTarget: obj,
            data: {
                originalEvent: originalEvent,
                global: this.getCanvasPosition(originalEvent),
                getLocalPosition: (target: any) => {
                    return {
                        x: (this.getCanvasPosition(originalEvent).x - (target.position?.x || 0)),
                        y: (this.getCanvasPosition(originalEvent).y - (target.position?.y || 0))
                    };
                }
            },
            stopPropagation: () => {},
            stopped: false
        };

        if (typeof listeners === 'function') {
            listeners(pixiEvent);
        } else if (Array.isArray(listeners)) {
            listeners.forEach((listener: Function) => listener(pixiEvent));
        }
    }

    private findObjectAtPosition(x: number, y: number): any | null {
        if (!this.lastRenderedContainer || !this.lastRenderedContainer.children) return null;

        const getGlobalPosition = (obj: any): { x: number; y: number } => {
            let globalX = obj.position?.x || 0;
            let globalY = obj.position?.y || 0;
            let current = obj.parent;

            while (current && current !== this.lastRenderedContainer) {
                if (current.position) {
                    globalX += current.position.x || 0;
                    globalY += current.position.y || 0;
                }
                if (current.scale) {
                    globalX *= current.scale.x || 1;
                    globalY *= current.scale.y || 1;
                }
                current = current.parent;
            }

            return { x: globalX, y: globalY };
        };

        const findInContainer = (container: any): any | null => {
            if (!container || !container.children) return null;

            for (let i = container.children.length - 1; i >= 0; i--) {
                const child = container.children[i];

                if (child.children && child.children.length > 0) {
                    const found = findInContainer(child);
                    if (found) return found;
                }

                if (child.type === 'graphics' || child.type === 'sprite') {
                    const globalPos = getGlobalPosition(child);
                    const bounds = this.getObjectBounds(child);
                    if (bounds && this.isPointInBounds(x - globalPos.x, y - globalPos.y, bounds)) {
                        return child;
                    }
                }
            }

            return null;
        };

        return findInContainer(this.lastRenderedContainer);
    }

    private getObjectBounds(obj: any): { x: number; y: number; width: number; height: number } | null {
        if (!obj) return null;

        if (obj.type === 'sprite' && obj.skiaImage) {
            const width = obj.width || obj.skiaImage.width();
            const height = obj.height || obj.skiaImage.height();
            const anchorX = obj.anchor?.x || 0;
            const anchorY = obj.anchor?.y || 0;

            return {
                x: -width * anchorX,
                y: -height * anchorY,
                width: width,
                height: height
            };
        }

        if (obj.geometry && obj.geometry.graphicsData) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const data of obj.geometry.graphicsData) {
                const shape = data.shape;
                if (!shape) continue;

                if (shape.radius !== undefined) {
                    const cx = shape.x || 0;
                    const cy = shape.y || 0;
                    const rx = shape.radius || shape.width || 0;
                    const ry = shape.radius || shape.height || rx;

                    minX = Math.min(minX, cx - rx);
                    minY = Math.min(minY, cy - ry);
                    maxX = Math.max(maxX, cx + rx);
                    maxY = Math.max(maxY, cy + ry);
                } else if (shape.width !== undefined && shape.height !== undefined) {
                    const x = shape.x || 0;
                    const y = shape.y || 0;
                    const w = shape.width;
                    const h = shape.height;

                    if (shape.type === 3) {
                        const rx = w / 2;
                        const ry = h / 2;
                        minX = Math.min(minX, x - rx);
                        minY = Math.min(minY, y - ry);
                        maxX = Math.max(maxX, x + rx);
                        maxY = Math.max(maxY, y + ry);
                    } else {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + w);
                        maxY = Math.max(maxY, y + h);
                    }
                } else if (shape.points && shape.points.length >= 4) {
                    for (let i = 0; i < shape.points.length; i += 2) {
                        if (shape.points[i + 1] !== undefined) {
                            minX = Math.min(minX, shape.points[i]);
                            minY = Math.min(minY, shape.points[i + 1]);
                            maxX = Math.max(maxX, shape.points[i]);
                            maxY = Math.max(maxY, shape.points[i + 1]);
                        }
                    }
                }
            }

            if (minX !== Infinity) {
                return {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            }
        }

        return null;
    }

    private isPointInBounds(x: number, y: number, bounds: { x: number; y: number; width: number; height: number }): boolean {
        return x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height;
    }

    public setOnObjectClick(callback: (obj: any) => void): void {
        this.onObjectClick = callback;
    }

    public setOnObjectHover(callback: (obj: any | null) => void): void {
        this.onObjectHover = callback;
    }

    public setOnObjectDrag(callback: (obj: any, dx: number, dy: number) => void): void {
        this.onObjectDrag = callback;
    }

    public setOnChangeCallback(callback: () => void): void {
        this.onChangeCallback = callback;
    }

    public setAutoUpdate(enabled: boolean): void {
        this.autoUpdate = enabled;
        if (enabled && this.lastRenderedContainer) {
            this.forceUpdate();
        }
    }

    public forceUpdate(): void {
        if (this.lastRenderedContainer) {
            this.renderContainer(this.lastRenderedContainer);
        }
    }

    public updateNow(): void {
        this.forceUpdate();
    }

    private requestUpdate(): void {
        if (this.autoUpdate) {
            this.forceUpdate();
        }
    }

    private notifyChange(): void {
        if (this.onChangeCallback) {
            this.onChangeCallback();
        }
    }

    private getPaint(color: number[], style: any, strokeWidth: number = 1): any {
        const key = `${color.join(',')}_${style}_${strokeWidth}`;

        if (!this.paintPool.has(key)) {
            const paint = new this.canvasKit.Paint();
            paint.setAntiAlias(true);
            paint.setStyle(style);
            paint.setColor(color);
            if (style === this.canvasKit.PaintStyle.Stroke) {
                paint.setStrokeWidth(strokeWidth);
            }
            this.paintPool.set(key, paint);
        }

        return this.paintPool.get(key);
    }

    private getPath(): any {
        return this.pathPool.pop() || new this.canvasKit.Path();
    }

    private releasePath(path: any): void {
        if (path && path.reset) {
            path.reset();
            this.pathPool.push(path);
        }
    }

    renderContainer(container: any): void {
        if (!this.isInitialized || !this.canvas) {
            this.log('Renderer не инициализирован');
            return;
        }

        if (!container) {
            this.log('Контейнер не предоставлен');
            return;
        }

        this.lastRenderedContainer = container;

        this.canvas.clear(this.canvasKit.Color4f(1, 1, 1, 1));
        this.renderSceneOnCanvas(this.canvas, container);
        this.surface.flush();

        this.notifyChange();
    }

    private renderSceneOnCanvas(targetCanvas: any, container: any): void {
        if (!container || !container.children) return;

        for (const child of container.children) {
            this.renderObject(targetCanvas, child);
        }
    }

    private renderObject(targetCanvas: any, obj: any): void {
        if (!obj || obj.visible === false) return;

        targetCanvas.save();

        try {
            if (obj.position) {
                targetCanvas.translate(
                    obj.position.x || 0,
                    obj.position.y || 0
                );
            }

            if (obj.angle) {
                targetCanvas.rotate(obj.angle, 0, 0);
            }

            if (obj.scale) {
                targetCanvas.scale(
                    obj.scale.x || 1,
                    obj.scale.y || 1
                );
            }

            if (obj.children && obj.children.length > 0) {
                for (const child of obj.children) {
                    this.renderObject(targetCanvas, child);
                }
            } else if (obj.type === 'sprite' || obj.geometry) {
                this.drawGraphics(targetCanvas, obj);
            }
        } catch (error) {
            this.log('Ошибка отрисовки объекта: ' + error);
        } finally {
            targetCanvas.restore();
        }
    }

    private drawGraphics(targetCanvas: any, graphics: any): void {
        try {
            if (graphics.type === 'sprite' && graphics.skiaImage) {
                const paint = this.getPaint(
                    [1, 1, 1, 1],
                    this.canvasKit.PaintStyle.Fill
                );

                const width = graphics.width || graphics.skiaImage.width();
                const height = graphics.height || graphics.skiaImage.height();

                targetCanvas.drawImage(graphics.skiaImage, 0, 0, paint);
                return;
            }

            const geom = graphics.geometry;
            if (!geom || !geom.graphicsData) return;

            for (const data of geom.graphicsData) {
                const shape = data.shape;
                if (!shape) continue;

                const path = this.getPath();
                if (!path) continue;

                if (shape.radius !== undefined) {
                    const r = shape.radius;
                    const cx = shape.x || 0;
                    const cy = shape.y || 0;
                    path.addCircle(cx, cy, r);
                }
                else if (shape.width !== undefined && shape.height !== undefined) {
                    const x = shape.x || 0;
                    const y = shape.y || 0;
                    const w = shape.width;
                    const h = shape.height;

                    if (shape.type === 4 || shape.type === 3) {
                        const rx = w;
                        const ry = h;
                        path.addOval([x - rx, y - ry, x + rx, y + ry]);
                    } else {
                        if (shape.drawFromCenter) {
                            const halfW = w / 2;
                            const halfH = h / 2;
                            path.addRect([x - halfW, y - halfH, x + halfW, y + halfH]);
                        } else {
                            path.addRect([x, y, x + w, y + h]);
                        }
                    }
                }
                else if (shape.points && shape.points.length >= 4) {
                    path.moveTo(shape.points[0], shape.points[1]);

                    for (let i = 2; i < shape.points.length; i += 2) {
                        if (shape.points[i + 1] !== undefined) {
                            path.lineTo(shape.points[i], shape.points[i + 1]);
                        }
                    }

                    if (shape.closeStroke || shape.type === 0) {
                        path.close();
                    }
                }

                const fill = data.fillStyle;
                if (fill && fill.visible !== false && fill.color !== undefined) {
                    const fillColor = this.parseColor(fill.color, fill.alpha);
                    const paint = this.getPaint(
                        fillColor,
                        this.canvasKit.PaintStyle.Fill
                    );
                    if (paint) {
                        targetCanvas.drawPath(path, paint);
                    }
                }

                const line = data.lineStyle;
                if (line && line.visible !== false && line.color !== undefined) {
                    const lineColor = this.parseColor(line.color, line.alpha);
                    const strokeWidth = line.width || 1;
                    const paint = this.getPaint(
                        lineColor,
                        this.canvasKit.PaintStyle.Stroke,
                        strokeWidth
                    );
                    if (paint) {
                        targetCanvas.drawPath(path, paint);
                    }
                }

                this.releasePath(path);
            }
        } catch (error) {
            this.log('Ошибка отрисовки графики: ' + error);
        }
    }

    private parseColor(color: number, alpha?: number): number[] {
        return [
            ((color >> 16) & 0xFF) / 255,
            ((color >> 8) & 0xFF) / 255,
            (color & 0xFF) / 255,
            alpha !== undefined ? alpha : 1
        ];
    }

    async exportToPDF(): Promise<Uint8Array> {
        if (!this.isInitialized || !this.htmlCanvas || !this.surface) {
            throw new Error('Renderer не инициализирован');
        }

        if (!this.pdfExporter) {
            throw new Error('PDF экспортер не создан');
        }

        if (!this.lastRenderedContainer) {
            throw new Error('Нет доступного кадра для экспорта. Сначала отрендерите сцену.');
        }

        const width = this.htmlCanvas.width || 800;
        const height = this.htmlCanvas.height || 600;

        return await this.pdfExporter.exportToPDF((pdfCanvas: any) => {
            this.renderSceneOnCanvas(pdfCanvas, this.lastRenderedContainer);
        }, width, height);
    }

    clear(): void {
        if (this.canvas && this.canvasKit) {
            this.canvas.clear(this.canvasKit.Color4f(1, 1, 1, 1));
            if (this.surface) {
                this.surface.flush();
            }
        }
    }

    dispose(): void {
        if (this.htmlCanvas) {
            const boundPointerDown = this.handlePointerDown.bind(this);
            const boundPointerMove = this.handlePointerMove.bind(this);
            const boundPointerUp = this.handlePointerUp.bind(this);
            const boundPointerLeave = this.handlePointerLeave.bind(this);

            this.htmlCanvas.removeEventListener('pointerdown', boundPointerDown);
            this.htmlCanvas.removeEventListener('pointermove', boundPointerMove);
            this.htmlCanvas.removeEventListener('pointerup', boundPointerUp);
            this.htmlCanvas.removeEventListener('pointerleave', boundPointerLeave);
            this.htmlCanvas.removeEventListener('pointercancel', boundPointerUp);
        }

        this.interactiveObjects.clear();
        this.hitTestCache.clear();
        this.currentHoverObject = null;
        this.currentDragObject = null;

        this.onObjectClick = null;
        this.onObjectHover = null;
        this.onObjectDrag = null;

        for (const paint of this.paintPool.values()) {
            if (paint && typeof paint.delete === 'function') {
                paint.delete();
            }
        }
        this.paintPool.clear();

        for (const path of this.pathPool) {
            if (path && typeof path.delete === 'function') {
                path.delete();
            }
        }
        this.pathPool = [];

        if (this.surface) {
            this.surface.delete();
            this.surface = null;
        }

        this.canvas = null;
        this.isInitialized = false;
        this.pdfExporter = null;
        this.lastRenderedContainer = null;
        this.htmlCanvas = null;
        this.onChangeCallback = null;
    }
}