/**
 * Type declarations for CanvasKit WASM
 */

declare module 'canvaskit-wasm' {
    export interface CanvasKit {
        MakeCanvasSurface(canvas: HTMLCanvasElement): Surface | null;
        MakeSWCanvasSurface(canvas: HTMLCanvasElement): Surface | null;
        PaintStyle: {
            Fill: PaintStyle;
            Stroke: PaintStyle;
        };
        WHITE: Color;
        Path: PathConstructor;
        Paint: PaintConstructor;
        PDFDocument: PDFDocumentConstructor;
        DynamicMemoryWStream: DynamicMemoryWStreamConstructor;
        MakeImageFromCanvasImageSource(source: CanvasImageSource): Image | null;
        XYWHRect(x: number, y: number, w: number, h: number): Rect;
    }

    export interface Surface {
        getCanvas(): Canvas;
        flush(): void;
        delete(): void;
    }

    export interface Canvas {
        clear(color: Color): void;
        save(): void;
        restore(): void;
        translate(x: number, y: number): void;
        rotate(degrees: number, x: number, y: number): void;
        scale(sx: number, sy: number): void;
        drawPath(path: Path, paint: Paint): void;
        drawImage(image: Image, x: number, y: number, paint: Paint): void;
        drawRect(rect: number[], paint: Paint): void;
    }

    export interface Path {
        moveTo(x: number, y: number): void;
        lineTo(x: number, y: number): void;
        addRect(rect: number[]): void;
        addOval(oval: Rect): void;
        addCircle(x: number, y: number, radius: number): void;
        close(): void;
        delete(): void;
    }

    export interface Paint {
        setColor(color: number[]): void;
        setAlphaf(alpha: number): void;
        setStyle(style: PaintStyle): void;
        setStrokeWidth(width: number): void;
        setAntiAlias(aa: boolean): void;
        delete(): void;
    }

    export interface PDFDocument {
        beginPage(width: number, height: number): PDFPage;
        endPage(): void;
        close(): void;
        delete(): void;
    }

    export interface PDFPage {
        getCanvas(): Canvas;
    }

    export interface DynamicMemoryWStream {
        detachAsData(): PDFData;
        delete(): void;
    }

    export interface PDFData {
        size(): number;
        getByte(index: number): number;
        delete(): void;
    }

    export interface Image {
        delete(): void;
    }

    export interface Color {}
    export interface PaintStyle {}
    export interface Rect {}

    export interface PathConstructor {
        new(): Path;
    }

    export interface PaintConstructor {
        new(): Paint;
    }

    export interface PDFDocumentConstructor {
        new(stream: DynamicMemoryWStream): PDFDocument;
    }

    export interface DynamicMemoryWStreamConstructor {
        new(): DynamicMemoryWStream;
    }

    export default function CanvasKitInit(options: {
        locateFile: (file: string) => string;
    }): Promise<CanvasKit>;
}