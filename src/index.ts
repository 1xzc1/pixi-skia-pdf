import { UIController } from './ui/UIController';

let appController: UIController | null = null;

async function loadCanvasKit(): Promise<any> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/canvaskit/canvaskit.js';

        script.onload = async () => {
            try {
                const canvasKit = await (window as any).CanvasKitInit({
                    locateFile: (file: string) => {
                        if (file.endsWith('.wasm')) {
                            return '/canvaskit/' + file;
                        }
                        return file;
                    }
                });
                resolve(canvasKit);
            } catch (error) {
                reject(error);
            }
        };
        script.onerror = () => reject(new Error('Failed to load CanvasKit'));
        document.head.appendChild(script);
    });
}

function bindGlobalFunctions(): void {
    (window as any).addRandomShape = () => {
        if (appController) appController.addRandomShape();
    };

    (window as any).switchScene = () => {
        if (appController) appController.switchScene();
    };

    (window as any).clearScene = () => {
        if (appController) appController.clearScene();
    };

    (window as any).toggleAutoSwitch = () => {
        if (appController) appController.toggleAutoSwitch();
    };

    (window as any).exportToPDF = () => {
        if (appController) appController.exportToPDF();
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const canvasKit = await loadCanvasKit();
        (window as any).canvasKit = canvasKit;

        appController = new UIController();
        bindGlobalFunctions();
    } catch (error) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = `Ошибка: ${(error as Error).message}`;
            statusEl.style.color = 'red';
        }
    }
});