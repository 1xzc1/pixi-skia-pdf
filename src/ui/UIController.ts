import { SceneManager } from '../pixi/SceneManager';
import { SkiaRenderer } from '../skia/SkiaRenderer';
import img from '../assets/img.jpeg';

export class UIController {
    private sceneManager: SceneManager;
    private skiaRenderer: SkiaRenderer;
    private statusElement: HTMLElement;
    private eventsContent: HTMLElement;
    private isInitialized: boolean = false;

    constructor() {
        this.statusElement = document.getElementById('status') as HTMLElement;
        this.eventsContent = document.getElementById('events-content') as HTMLElement;

        if (!this.statusElement || !this.eventsContent) {
            console.error('Не найдены элементы UI');
        }

        this.skiaRenderer = new SkiaRenderer();

        this.skiaRenderer.setLogEventCallback((message: string) => {
            this.logEvent(message);
        });

        this.sceneManager = new SceneManager(
            document.getElementById('pixi-container') as HTMLElement,
            this.skiaRenderer
        );

        this.initializeApplication();
    }

    private async initializeApplication(): Promise<void> {
        try {
            this.logEvent('Запуск приложения');
            this.updateStatus('Инициализация Skia...');

            const skiaCanvas = document.getElementById('skia-canvas') as HTMLCanvasElement;
            if (!skiaCanvas) {
                throw new Error('Canvas элемент не найден');
            }

            skiaCanvas.width = 800;
            skiaCanvas.height = 600;

            await this.skiaRenderer.initialize(skiaCanvas);

            this.isInitialized = true;
            this.updateStatus('Готов');
            this.logEvent('Приложение инициализировано');

            await this.loadInitialSprite();

        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.updateStatus('Ошибка: ' + (error as Error).message);
            this.logEvent('Ошибка: ' + (error as Error).message);
        }
    }

    private async loadInitialSprite(): Promise<void> {
        try {
            this.logEvent('Загрузка стартового изображения...');
            await this.sceneManager.addSpriteWithImage(img, 300, 250);
            this.logEvent('Стартовое изображение успешно выведено на холсты');
        } catch (error) {
            console.error('Ошибка загрузки стартового изображения:', error);
            this.logEvent('Ошибка загрузки картинки: ' + (error as Error).message);
        }
    }

    addRandomShape(): void {
        this.sceneManager.addRandomShape();
        this.logEvent('Добавлена случайная фигура');
    }

    switchScene(): void {
        this.sceneManager.switchScene();
        this.logEvent('Сцена переключена');
    }

    clearScene(): void {
        this.sceneManager.clearScene();
        this.logEvent('Сцена очищена');
    }

    toggleAutoSwitch(): void {
        const isActive = this.sceneManager.toggleAutoSwitch();
        this.updateStatus(isActive ? 'Автопереключение: ВКЛ' : 'Автопереключение: ВЫКЛ');
        this.logEvent(isActive ? 'Автопереключение включено' : 'Автопереключение выключено');
    }

    async exportToPDF(): Promise<void> {
        try {
            this.updateStatus('Создание PDF...');
            this.logEvent('Начат экспорт PDF');

            const pdfBytes = await this.skiaRenderer.exportToPDF();

            if (!pdfBytes || pdfBytes.length === 0) {
                throw new Error('PDF файл пуст');
            }

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixi-vector-scene-${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.updateStatus('PDF сохранен');
            this.logEvent(`PDF создан (${(pdfBytes.length / 1024).toFixed(1)} KB)`);

        } catch (error) {
            console.error('Ошибка экспорта PDF:', error);
            this.updateStatus('Ошибка экспорта');
            this.logEvent('Ошибка: ' + (error as Error).message);
        }
    }

    private updateStatus(message: string): void {
        if (this.statusElement) {
            this.statusElement.textContent = `Статус: ${message}`;
        }
    }

    private logEvent(message: string): void {
        if (this.eventsContent) {
            const div = document.createElement('div');
            const time = new Date().toLocaleTimeString();
            div.textContent = `[${time}] ${message}`;
            div.style.padding = '2px 0';
            div.style.borderBottom = '1px solid #f0f0f0';
            this.eventsContent.insertBefore(div, this.eventsContent.firstChild);

            while (this.eventsContent.children.length > 50) {
                this.eventsContent.removeChild(this.eventsContent.lastChild!);
            }
        }
    }
}