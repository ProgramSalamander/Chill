import JSZip from 'jszip';
import { File } from '../types';
import { getFilePath } from './fileUtils';

/**
 * Bundles all files in the current workspace into a ZIP and triggers a download.
 */
export const downloadProjectAsZip = async (files: File[], projectName: string = 'chill-project') => {
  const zip = new JSZip();
  
  // Only include actual files in the zip content
  const actualFiles = files.filter(f => f.type === 'file');
  
  if (actualFiles.length === 0) {
    throw new Error('Project is empty. Add some files before downloading.');
  }

  actualFiles.forEach((file) => {
    const filePath = getFilePath(file, files);
    zip.file(filePath, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.zip`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
};