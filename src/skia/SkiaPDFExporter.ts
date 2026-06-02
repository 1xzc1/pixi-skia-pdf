export class PDFExporter {
    private canvasKit: any;

    constructor(canvasKit: any) {
        this.canvasKit = canvasKit;
    }

    async exportToPDF(
        renderCallback: (canvas: any) => void,
        width: number = 800,
        height: number = 600
    ): Promise<Uint8Array> {

        if (!renderCallback || typeof renderCallback !== 'function') {
            throw new Error('Необходимо передать функцию отрисовки сцены renderCallback');
        }

        if (!this.canvasKit.MakePDFFromCallback) {
            throw new Error('Метод MakePDFFromCallback не найден в CanvasKit. Проверьте сборку.');
        }

        console.log('[PDFExporter] Запуск нативного векторного C++ рендеринга PDF...');

        const pdfBytes = this.canvasKit.MakePDFFromCallback(width, height, (readyCanvas: any) => {
            renderCallback(readyCanvas);
        });

        if (!pdfBytes) {
            throw new Error('C++ движок Skia не смог сгенерировать PDF документ');
        }

        return pdfBytes;
    }
}
