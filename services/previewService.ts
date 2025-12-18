
import { File } from '../types';
import { getFilePath } from '../utils/fileUtils';

class PreviewService {
  private sw: ServiceWorker | null = null;

  constructor() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        this.sw = registration.active;
      });
    }
  }

  /**
   * Pushes file contents to the Service Worker cache to serve them via /preview/
   */
  public updatePreviewFiles(files: File[]) {
    if (!this.sw) return;

    files.forEach(file => {
      if (file.type === 'file') {
        const path = getFilePath(file, files);
        
        let mimeType = 'text/plain';
        if (path.endsWith('.html')) mimeType = 'text/html';
        else if (path.endsWith('.css')) mimeType = 'text/css';
        else if (path.endsWith('.js')) mimeType = 'application/javascript';
        else if (path.endsWith('.json')) mimeType = 'application/json';
        else if (path.endsWith('.png')) mimeType = 'image/png';
        
        this.sw!.postMessage({
          type: 'UPDATE_PREVIEW_FILE',
          path: path,
          content: file.content,
          mimeType: mimeType
        });
      }
    });
  }
}

export const previewService = new PreviewService();
