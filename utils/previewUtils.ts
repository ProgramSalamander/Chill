import { File } from '../types';
import showdown from 'showdown';

const converter = new showdown.Converter({
    tables: true,
    strikethrough: true,
    tasklists: true,
    simpleLineBreaks: true,
});

const markdownPreviewTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
    <title>Markdown Preview</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
            line-height: 1.6;
            color: #e2e8f0;
            background-color: #050508;
            padding: 2rem;
            margin: 0;
        }
        .markdown-body {
            max-width: 800px;
            margin: 0 auto;
        }
        .markdown-body > *:first-child {
            margin-top: 0 !important;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
            border-bottom: 1px solid #334155;
            padding-bottom: .3em;
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        .markdown-body h1 { font-size: 2em; }
        .markdown-body h2 { font-size: 1.5em; }
        .markdown-body h3 { font-size: 1.25em; }
        .markdown-body code {
            background-color: rgba(129, 140, 248, 0.15);
            color: #c7d2fe;
            padding: .2em .4em;
            margin: 0;
            font-size: 85%;
            border-radius: 6px;
            font-family: "JetBrains Mono", monospace;
        }
        .markdown-body pre {
            background-color: #0f172a;
            padding: 16px;
            overflow: auto;
            line-height: 1.45;
            border-radius: 6px;
            border: 1px solid #334155;
        }
        .markdown-body pre code {
            background: none;
            padding: 0;
            margin: 0;
            font-size: 100%;
            color: #e2e8f0;
        }
        .markdown-body blockquote {
            padding: 0 1em;
            color: #94a3b8;
            border-left: .25em solid #4f46e5;
            margin-left: 0;
            margin-right: 0;
        }
        .markdown-body ul, .markdown-body ol {
            padding-left: 2em;
            margin-top: 0;
            margin-bottom: 16px;
        }
        .markdown-body a {
            color: #818cf8;
            text-decoration: none;
        }
        .markdown-body a:hover {
            text-decoration: underline;
        }
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 0;
            margin-bottom: 16px;
        }
        .markdown-body th, .markdown-body td {
            border: 1px solid #334155;
            padding: 6px 13px;
        }
        .markdown-body th {
            font-weight: 600;
        }
        .markdown-body tr {
            background-color: transparent;
            border-top: 1px solid #334155;
        }
        .markdown-body tr:nth-child(2n) {
            background-color: rgba(255, 255, 255, 0.03);
        }
        .markdown-body img {
            max-width: 100%;
            box-sizing: content-box;
            background-color: #fff;
        }
        .markdown-body hr {
            height: .25em;
            padding: 0;
            margin: 24px 0;
            background-color: #334155;
            border: 0;
        }
    </style>
</head>
<body class="markdown-body">
    ${content}
</body>
</html>
`;

export const generatePreviewHtml = (files: File[], activeFile: File | null): string => {
    if (activeFile?.language === 'markdown') {
        const markdownHtml = converter.makeHtml(activeFile.content);
        return markdownPreviewTemplate(markdownHtml);
    }

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