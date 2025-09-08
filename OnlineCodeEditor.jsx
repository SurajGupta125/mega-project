// OnlineCodeEditor.jsx
// Single-file React component for a browser-based HTML/CSS/JS editor with live preview.
// Requirements: React, @monaco-editor/react, TailwindCSS (optional but used for styling)

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

// Utility helpers
const encodeState = (s) => {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  } catch (e) {
    return "";
  }
};
const decodeState = (str) => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    return null;
  }
};

const DEFAULT_TEMPLATE = {
  html: `<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Playground</title>
  </head>
  <body>
    <div id=\"app\">Hello — write HTML, CSS & JS!</div>
  </body>
</html>`,
  css: `/* Styles go here */
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; padding: 24px; }
#app { padding: 20px; border-radius: 8px; background: #f7f7f7; }
`,
  js: `// JS goes here
const el = document.getElementById('app');
el.innerHTML += '<p style="color:green">JS ran</p>';
`,
};

export default function OnlineCodeEditor({ initial = {}, storageKey = "online-code-editor-v1" }) {
  // load from URL (share) or localStorage or defaults
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlCode = urlParams.get("code");

  const fromUrl = urlCode ? decodeState(urlCode) : null;
  const fromStorage = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  const [html, setHtml] = useState(fromUrl?.html ?? fromStorage?.html ?? initial.html ?? DEFAULT_TEMPLATE.html);
  const [css, setCss] = useState(fromUrl?.css ?? fromStorage?.css ?? initial.css ?? DEFAULT_TEMPLATE.css);
  const [js, setJs] = useState(fromUrl?.js ?? fromStorage?.js ?? initial.js ?? DEFAULT_TEMPLATE.js);

  const [layout, setLayout] = useState("side-by-side"); // 'side-by-side', 'stacked', 'preview-only'
  const [activeEditor, setActiveEditor] = useState("html");
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const iframeRef = useRef(null);

  // Build srcDoc for iframe preview
  const srcDoc = useMemo(() => {
    return `<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>
      try {
        ${js}
      } catch (e) {
        console.error(e);
        const pre = document.createElement('pre');
        pre.style.color = 'red';
        pre.textContent = e.stack || e.toString();
        document.body.appendChild(pre);
      }
    <\/script>
  </body>
</html>`;
  }, [html, css, js]);

  // debounced update for preview (when autoUpdate true)
  useEffect(() => {
    if (!autoUpdate) return;
    const t = setTimeout(() => {
      const doc = iframeRef.current && iframeRef.current.contentWindow && iframeRef.current.contentWindow.document;
      if (doc) {
        doc.open();
        doc.write(srcDoc);
        doc.close();
      }
    }, 300);
    return () => clearTimeout(t);
  }, [srcDoc, autoUpdate]);

  // Manual update action
  const refreshPreview = () => {
    const doc = iframeRef.current && iframeRef.current.contentWindow && iframeRef.current.contentWindow.document;
    if (doc) {
      doc.open();
      doc.write(srcDoc);
      doc.close();
    }
  };

  // Save to localStorage
  const saveToLocal = () => {
    const payload = { html, css, js, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSavedAt(new Date().toISOString());
    } catch (e) {
      console.warn("Could not save:", e);
    }
  };

  // Generate shareable URL (encoded state)
  const generateShareURL = () => {
    const code = encodeState({ html, css, js });
    const u = new URL(window.location.href);
    u.searchParams.set("code", code);
    return u.toString();
  };

  // Copy share URL to clipboard
  const copyShareURL = async () => {
    const url = generateShareURL();
    try {
      await navigator.clipboard.writeText(url);
      alert("Share URL copied to clipboard!");
    } catch (e) {
      prompt("Copy this URL:", url);
    }
  };

  // Export as ZIP/HTML file (simple download of index.html)
  const downloadProject = () => {
    const fileContent = srcDoc;
    const blob = new Blob([fileContent], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "playground.html";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Templates
  const TEMPLATES = {
    default: DEFAULT_TEMPLATE,
    starter: {
      html: `<!doctype html>\n<html><body><h1>Starter</h1><div id=\"app\"></div></body></html>`,
      css: `body{font-family:system-ui;padding:20px}`,
      js: `document.getElementById('app').innerText = 'Starter template loaded';`,
    },
    reactPlay: {
      html: `<!doctype html>\n<html><body><div id=\"root\"></div><script src=\"https://unpkg.com/react@18/umd/react.development.js\"></script><script src=\"https://unpkg.com/react-dom@18/umd/react-dom.development.js\"></script></body></html>`,
      css: `/* react play css */`,
      js: `const e = React.createElement; ReactDOM.createRoot(document.getElementById('root')).render(e('h2', null, 'React in iframe'));`,
    },
  };

  const applyTemplate = (name) => {
    const t = TEMPLATES[name];
    if (!t) return;
    setHtml(t.html);
    setCss(t.css);
    setJs(t.js);
  };

  // Load from URL if present on first render (already handled above via fromUrl)
  useEffect(() => {
    // If URL code present and we used it, refresh preview immediately
    if (fromUrl) {
      setTimeout(refreshPreview, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simple layout classes
  const containerClass = (() => {
    switch (layout) {
      case "stacked":
        return "grid grid-rows-2 gap-2 h-screen";
      case "preview-only":
        return "grid grid-rows-1 h-screen";
      default:
        return "grid grid-cols-2 gap-2 h-screen";
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="p-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <strong className="text-lg">Online Code Editor</strong>
          <div className="text-sm opacity-70">(HTML • CSS • JS — Monaco + Live preview)</div>
        </div>
        <div className="flex items-center gap-2">
          <select value={layout} onChange={(e) => setLayout(e.target.value)} className="border rounded px-2 py-1">
            <option value="side-by-side">Side-by-side</option>
            <option value="stacked">Stacked</option>
            <option value="preview-only">Preview only</option>
          </select>
          <button onClick={() => { setAutoUpdate(!autoUpdate); }} className="px-2 py-1 border rounded">Auto: {autoUpdate ? "On" : "Off"}</button>
          <button onClick={refreshPreview} className="px-2 py-1 border rounded">Refresh</button>
          <button onClick={saveToLocal} className="px-2 py-1 border rounded">Save</button>
          <button onClick={copyShareURL} className="px-2 py-1 border rounded">Share</button>
          <button onClick={downloadProject} className="px-2 py-1 border rounded">Download</button>
        </div>
      </div>

      <div className={`${containerClass}`}>
        {/* Editors area (hidden for preview-only) */}
        {layout !== "preview-only" && (
          <div className="p-2 border-r overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            <div className="flex gap-2 mb-2">
              <button className={`px-2 py-1 rounded ${activeEditor === 'html' ? 'bg-gray-200' : ''}`} onClick={() => setActiveEditor('html')}>HTML</button>
              <button className={`px-2 py-1 rounded ${activeEditor === 'css' ? 'bg-gray-200' : ''}`} onClick={() => setActiveEditor('css')}>CSS</button>
              <button className={`px-2 py-1 rounded ${activeEditor === 'js' ? 'bg-gray-200' : ''}`} onClick={() => setActiveEditor('js')}>JS</button>
              <div className="ml-auto flex gap-2">
                <select onChange={(e) => applyTemplate(e.target.value)} className="px-2 py-1 border rounded">
                  <option value="">Apply template</option>
                  <option value="default">Default</option>
                  <option value="starter">Starter</option>
                  <option value="reactPlay">React (UMD) example</option>
                </select>
                <button onClick={() => { setHtml(""); setCss(""); setJs(""); }} className="px-2 py-1 border rounded">Clear</button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded" style={{ minHeight: 0 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                language={activeEditor}
                value={activeEditor === 'html' ? html : activeEditor === 'css' ? css : js}
                onChange={(v) => {
                  if (activeEditor === 'html') setHtml(v || '');
                  if (activeEditor === 'css') setCss(v || '');
                  if (activeEditor === 'js') setJs(v || '');
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        )}

        {/* Preview pane */}
        <div className="p-2 bg-white overflow-hidden" style={{ minHeight: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm opacity-70">Preview</div>
            <div className="ml-auto text-xs opacity-60">{lastSavedAt ? `Saved: ${new Date(lastSavedAt).toLocaleString()}` : ''}</div>
          </div>
          <div className="border rounded h-full overflow-hidden" style={{ minHeight: 0 }}>
            <iframe
              ref={iframeRef}
              title="preview"
              srcDoc={autoUpdate ? undefined : srcDoc}
              sandbox="allow-scripts allow-forms allow-same-origin"
              style={{ width: '100%', height: '100%', border: '0' }}
            />
          </div>
        </div>
      </div>

      <div className="p-3 text-xs text-gray-600 border-t bg-white">
        <div className="flex gap-4">
          <div>Tips: Use the editors switcher or press Alt+1/2/3 to switch editors (not implemented — you can add keyboard handlers).</div>
          <div className="ml-auto">Sharing: click Share, copy the URL — it encodes your code in the query param.</div>
        </div>
      </div>
    </div>
  );
}
