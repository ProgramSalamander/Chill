
import { File } from '../types';

export const generatePreviewHtml = (files: File[], activeFile: File | null): string => {
    let rootHtmlFile = activeFile?.language === 'html' ? activeFile : files.find(f => f.name === 'index.html');
    
    if (!rootHtmlFile) {
        rootHtmlFile = files.find(f => f.language === 'html');
    }

    if (!rootHtmlFile) {
        return `
            <html>
                <body style="background-color: #050508; color: #64748b; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                    <div style="text-align: center;">
                        <h3 style="margin-bottom: 0.5rem; color: #e2e8f0;">No HTML Entry Point Found</h3>
                        <p style="font-size: 0.875rem;">Create an index.html file to enable Live Preview.</p>
                    </div>
                </body>
            </html>
        `;
    }

    let html = rootHtmlFile.content;

    const stripTypes = (code: string) => {
        return code
            .replace(/:\s*[a-zA-Z0-9_<>\[\]]+/g, '') 
            .replace(/<[a-zA-Z0-9_,\s]+>/g, ''); 
    };

    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*>/g, (match, href) => {
        if (href.includes('http')) return match; 
        
        const filename = href.split('/').pop();
        const cssFile = files.find(f => f.name === filename);
        if (cssFile) {
            return `<style>\n/* Injected from ${filename} */\n${cssFile.content}\n</style>`;
        }
        return match;
    });

    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g, (match, src) => {
        if (src.includes('http')) return match;

        const filename = src.split('/').pop();
        const jsFile = files.find(f => f.name === filename);
        if (jsFile) {
            let content = jsFile.content;
            if (jsFile.language === 'typescript') {
                content = stripTypes(content);
            }
            return `<script>\n// Injected from ${filename}\n${content}\n</script>`;
        }
        return match;
    });

    return html;
};
