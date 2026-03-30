/* ═══════════════════════════════════════════════════════════════
   VibeDesign — Smart AI Editor
   ═══════════════════════════════════════════════════════════════ */

(function initEditor() {
    "use strict";

    // ── CACHE DOM ───────────────────────────────────────────────
    const canvasWrap = document.getElementById("canvas-scroll-area");
    const docTitle = document.getElementById("doc-title");
    
    // Panels
    const sideIcons = document.querySelectorAll(".sidebar-icon");
    const sidePanels = document.querySelectorAll(".panel");

    // Grids
    const elementsGrid = document.getElementById("elements-grid");
    const uploadsGrid = document.getElementById("uploads-grid");
    const models3dGrid = document.getElementById("models3d-grid");

    // Toolbar
    const toolbar = document.getElementById("object-toolbar");
    const fillColor = document.getElementById("fill-color");
    const strokeColor = document.getElementById("stroke-color");
    const opacitySlider = document.getElementById("opacity-slider");
    const opacityVal = document.getElementById("opacity-val");
    const fontSelector = document.getElementById("font-selector");
    const fontSize = document.getElementById("font-size");

    // Actions
    const btnDel = document.getElementById("btn-delete");
    const btnBringFront = document.getElementById("btn-bring-front");
    const btnSendBack = document.getElementById("btn-send-back");
    const btnExport = document.getElementById("btn-export");

    // Added Actions
    const btnUndo = document.getElementById("btn-undo");
    const btnRedo = document.getElementById("btn-redo");
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomFit = document.getElementById("btn-zoom-fit");
    const btnFullscreen = document.getElementById("btn-fullscreen");
    const zoomLevelEl = document.getElementById("zoom-level");
    const editorLayout = document.getElementById("editor-layout");
    const uploadZone = document.getElementById("editor-upload-zone");
    const fileInput = document.getElementById("editor-file-input");
    const canvasWorkspace = document.getElementById("canvas-workspace");
    const shapesFlowerGrid = document.getElementById("shapes-flower-grid");

    // AI Tools
    const btnAiBgRemove = document.getElementById("btn-ai-bg-remove");
    const btnSmartLayout = document.getElementById("btn-ai-smart-layout");
    const btnSmartColor = document.getElementById("btn-ai-color-grade");
    const btnSmartWrap = document.getElementById("btn-smart-wrap");

    // Network State
    const onlineIndicator = document.getElementById("online-indicator");
    const dot = onlineIndicator.querySelector(".indicator-dot");
    const lbl = onlineIndicator.querySelector(".indicator-label");

    // ── FABRIC INIT ─────────────────────────────────────────────
    // Set custom light calm theme defaults
    const THEME = {
        primary: "#7c6dd8",
        secondary: "#b0a3f3",
        text: "#2c2c34",
        muted: "#9e9baa",
        bg: "#f4f1ee"
    };

    let canvas = new fabric.Canvas("fabric-canvas", {
        width: 800,
        height: 600,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
    });

    // --- CHECK FOR TRANSFERRED LAYOUT FROM DASHBOARD ---
    const transferredJson = localStorage.getItem('vibe_transfer_canvas');
    if (transferredJson) {
        try {
            canvas.loadFromJSON(transferredJson, () => {
                canvas.renderAll();
                localStorage.removeItem('vibe_transfer_canvas');
            });
        } catch(e) { console.error("Could not load transferred card layout", e); }
    }

    // --- HISTORY (UNDO/REDO) ---
    let undoStack = [];
    let redoStack = [];
    let isHistoryProcessing = false;

    function saveHistory() {
        if (isHistoryProcessing) return;
        undoStack.push(JSON.stringify(canvas.toDatalessJSON()));
        redoStack = []; // clear redo on new action
    }

    canvas.on('object:added', saveHistory);
    canvas.on('object:modified', saveHistory);
    canvas.on('object:removed', saveHistory);

    // Initial state
    setTimeout(saveHistory, 100);

    // Resize canvas to fit viewport
    let currentScale = 1;
    let manualZoom = 1;

    function resizeCanvas() {
        if (!document.fullscreenElement) {
            const cw = canvasWrap.clientWidth - 80;
            const ch = canvasWrap.clientHeight - 80;
            // Keep 4:3 aspect ratio
            const ar = 800 / 600;
            let nw = cw;
            let nh = cw / ar;
            if (nh > ch) { nh = ch; nw = nh * ar; }
            currentScale = Math.min(nw/800, nh/600);
        }
        
        // Use CSS zoom for responsive canvas
        const frame = document.getElementById("canvas-frame");
        frame.style.width = `800px`;
        frame.style.height = `600px`;
        frame.style.transform = `scale(${currentScale * manualZoom})`;
        
        if (zoomLevelEl) {
            zoomLevelEl.textContent = Math.round(manualZoom * 100) + "%";
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ── SIDEBAR LOGIC ───────────────────────────────────────────
    sideIcons.forEach(icon => {
        icon.addEventListener("click", () => {
            sideIcons.forEach(i => i.classList.remove("active"));
            sidePanels.forEach(p => p.classList.remove("active"));
            icon.classList.add("active");
            document.querySelector(`.panel[data-panel-id="${icon.dataset.panel}"]`).classList.add("active");
        });
    });

    // ── DATA FETCH ──────────────────────────────────────────────
    async function loadAssets() {
        try {
            const res = await fetch("/api/editor-assets");
            const payload = await res.json();
            if (payload.status === "success") {
                renderAssets(payload.data);
            }
        } catch (e) {
            console.error("Failed to load assets", e);
        }
    }

    function renderAssets(data) {
        elementsGrid.innerHTML = "";
        uploadsGrid.innerHTML = "";
        models3dGrid.innerHTML = "";

        // Elements (SVGs)
        data.shapes.concat(data.icons, data.ribbons).forEach(asset => {
            const thumb = createThumb(asset, 'svg');
            thumb.addEventListener("click", () => addSvg(asset));
            elementsGrid.appendChild(thumb);
        });

        // Uploads (PNGs/JPGs)
        data.stickers.concat(data.flowers, data.people, data.decorations).forEach(asset => {
            const thumb = createThumb(asset, 'img');
            thumb.addEventListener("click", () => addImage(asset, true));
            uploadsGrid.appendChild(thumb);
        });

        // Flowers
        if (shapesFlowerGrid) {
            shapesFlowerGrid.innerHTML = "";
            const flowerUrls = ["f1.jpg", "f2.jpg", "f3.jpg", "f4.jpg"].map(f => `/static/assets/shapes/flower/${f}`);
            flowerUrls.forEach(url => {
                const thumb = createThumb(url, 'img');
                thumb.addEventListener("click", () => addImage(url, true));
                shapesFlowerGrid.appendChild(thumb);
            });
        }

        // 3D Models
        data["3d_models"].forEach((asset) => {
            const thumb = document.createElement("div");
            thumb.className = "model-card";
            const fname = asset.split("/").pop();
            thumb.innerHTML = `
                <div class="model-icon">3D</div>
                <div class="model-name" title="${fname}">${fname}</div>
            `;
            thumb.addEventListener("click", () => {
                if(window.add3DModelToScene) {
                    window.add3DModelToScene(asset);
                } else {
                    showToast("3D Environment warming up...", "error");
                }
            });
            models3dGrid.appendChild(thumb);
        });
    }

    function createThumb(url, type) {
        const d = document.createElement("div");
        d.className = "asset-thumb";
        const img = document.createElement("img");
        img.src = url;
        img.loading = "lazy";
        d.appendChild(img);
        return d;
    }

    // ── CANVAS ADDITIONS ────────────────────────────────────────
    function smartFitToCenter(obj) {
        const padding = 40;
        const maxW = canvas.width - padding;
        const maxH = canvas.height - padding;
        let scale = 1;
        
        if (obj.width && obj.height) {
            const scaleX = maxW / obj.width;
            const scaleY = maxH / obj.height;
            scale = Math.min(scaleX, scaleY, 1);
            if (scale < 1) {
                obj.scale(scale);
            }
        }
        
        obj.set({
            left: (canvas.width / 2) - ((obj.width * scale) / 2),
            top: (canvas.height / 2) - ((obj.height * scale) / 2)
        });
        obj.setCoords();
    }

    function addSvg(url) {
        fabric.loadSVGFromURL(url, (objects, options) => {
            const svgGroup = fabric.util.groupSVGElements(objects, options);
            smartFitToCenter(svgGroup);
            canvas.add(svgGroup);
            canvas.setActiveObject(svgGroup);
            canvas.renderAll();
        });
    }

    function addImage(url, useSmartFit=false) {
        fabric.Image.fromURL(url, (img) => {
            if (useSmartFit) {
                smartFitToCenter(img);
            } else {
                img.scaleToWidth(200);
                img.set({ left: 100, top: 100 });
            }
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }

    // Shapes
    document.querySelectorAll(".shape-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.shape;
            let obj;
            const props = { left: 150, top: 150, fill: THEME.primary, strokeWidth: 0, rx:0, ry:0 };
            
            if (type === "rect") {
                obj = new fabric.Rect({ ...props, width: 100, height: 100 });
            } else if (type === "circle") {
                obj = new fabric.Circle({ ...props, radius: 50 });
            } else if (type === "triangle") {
                obj = new fabric.Triangle({ ...props, width: 100, height: 100 });
            } else if (type === "star") {
               // Pseudo star using polygon
               obj = new fabric.Polygon([
                    { x: 50, y: 0 }, { x: 61, y: 35 }, { x: 98, y: 35 },
                    { x: 68, y: 57 }, { x: 79, y: 91 }, { x: 50, y: 70 },
                    { x: 21, y: 91 }, { x: 32, y: 57 }, { x: 2, y: 35 },
                    { x: 39, y: 35 }
                ], { ...props });
            } else if (type === "line") {
                obj = new fabric.Line([50, 50, 150, 150], { left: 150, top: 150, stroke: THEME.primary, strokeWidth: 4 });
            }

            if (obj) {
                canvas.add(obj);
                canvas.setActiveObject(obj);
            }
        });
    });

    // Text Presets
    document.querySelectorAll(".text-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.preset;
            let size = 20, weight = 400, text = "Body Text", color = THEME.text;
            if (type === "heading") { size = 56; weight = 800; text = "A New Heading"; }
            if (type === "subheading") { size = 32; weight = 600; text = "A Subheading"; }
            
            const t = new fabric.Textbox(text, {
                left: 100, top: 100,
                width: 300,
                fontSize: size,
                fontWeight: weight,
                fontFamily: "Inter",
                fill: color
            });
            canvas.add(t);
            canvas.setActiveObject(t);
        });
    });

    // ── TOOLBAR SYNC ────────────────────────────────────────────
    canvas.on("selection:created", updateToolbar);
    canvas.on("selection:updated", updateToolbar);
    canvas.on("selection:cleared", () => toolbar.classList.add("hidden"));
    canvas.on("object:modified", updateToolbar);

    function updateToolbar() {
        const obj = canvas.getActiveObject();
        if (!obj) {
            toolbar.classList.add("hidden");
            return;
        }

        toolbar.classList.remove("hidden");
        
        // Fill
        if (obj.fill && typeof obj.fill === 'string') fillColor.value = obj.fill;
        // Stroke
        if (obj.stroke && typeof obj.stroke === 'string') strokeColor.value = obj.stroke;
        // Opacity
        if (obj.opacity !== undefined) {
            const pct = Math.round(obj.opacity * 100);
            opacitySlider.value = pct;
            opacityVal.textContent = pct + "%";
        }
        // Text props
        if (obj.type === 'textbox' || obj.type === 'text') {
            fontSelector.value = obj.fontFamily || "Inter";
            fontSize.value = obj.fontSize || 24;
            fontSelector.parentElement.style.display = "";
            fontSize.parentElement.style.display = "";
        } else {
            fontSelector.parentElement.style.display = "none";
            fontSize.parentElement.style.display = "none";
        }
    }

    // Mutate objects
    fillColor.addEventListener("input", (e) => {
        const obj = canvas.getActiveObject();
        if (obj) { obj.set('fill', e.target.value); canvas.renderAll(); }
    });
    strokeColor.addEventListener("input", (e) => {
        const obj = canvas.getActiveObject();
        if (obj) { obj.set('stroke', e.target.value); canvas.renderAll(); }
    });
    opacitySlider.addEventListener("input", (e) => {
        const obj = canvas.getActiveObject();
        if (obj) {
            const val = e.target.value / 100;
            obj.set('opacity', val);
            opacityVal.textContent = e.target.value + "%";
            canvas.renderAll();
        }
    });
    fontSelector.addEventListener("change", (e) => {
        const obj = canvas.getActiveObject();
        if (obj && obj.set) { obj.set('fontFamily', e.target.value); canvas.renderAll(); }
    });
    fontSize.addEventListener("input", (e) => {
        const obj = canvas.getActiveObject();
        if (obj && obj.set) { obj.set('fontSize', parseInt(e.target.value, 10)); canvas.renderAll(); }
    });

    btnDel.addEventListener("click", () => {
        canvas.getActiveObjects().forEach(o => canvas.remove(o));
        canvas.discardActiveObject().renderAll();
    });
    // Keyboard Shortcuts handles delete inside the combined event further down.

    btnBringFront.addEventListener("click", () => {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.bringToFront(obj); canvas.renderAll(); }
    });
    btnSendBack.addEventListener("click", () => {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.sendToBack(obj); canvas.renderAll(); }
    });

    // ── NEW FEATURES (UNDO/REDO, ZOOM, FULLSCREEN, EXPORT, UPLOAD, DND) ──
    
    // Undo / Redo
    btnUndo.addEventListener("click", () => {
        if (undoStack.length > 1) { // >1 because the first is the initial state
            isHistoryProcessing = true;
            const currentState = undoStack.pop();
            redoStack.push(currentState);
            const prevState = undoStack[undoStack.length - 1];
            canvas.loadFromJSON(prevState, () => {
                canvas.renderAll();
                isHistoryProcessing = false;
            });
        } else {
            showToast("Nothing to undo", "warning");
        }
    });

    btnRedo.addEventListener("click", () => {
        if (redoStack.length > 0) {
            isHistoryProcessing = true;
            const nextState = redoStack.pop();
            undoStack.push(nextState);
            canvas.loadFromJSON(nextState, () => {
                canvas.renderAll();
                isHistoryProcessing = false;
            });
        }
    });

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || canvas.getActiveObject()?.isEditing) return;
        
        if (e.key === "Delete" || e.key === "Backspace") {
            canvas.getActiveObjects().forEach(o => canvas.remove(o));
            canvas.discardActiveObject().renderAll();
        } else if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            btnUndo.click();
        } else if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
            e.preventDefault();
            btnRedo.click();
        }
    });

    // Zoom
    btnZoomIn.addEventListener("click", () => {
        manualZoom += 0.1;
        if (manualZoom > 3) manualZoom = 3;
        resizeCanvas();
    });
    btnZoomOut.addEventListener("click", () => {
        manualZoom -= 0.1;
        if (manualZoom < 0.2) manualZoom = 0.2;
        resizeCanvas();
    });
    btnZoomFit.addEventListener("click", () => {
        manualZoom = 1;
        resizeCanvas();
    });

    // Full screen
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            editorLayout.requestFullscreen().catch(err => {
                showToast(`Error attempting to enable fullscreen: ${err.message}`, "error");
            });
        } else {
            document.exitFullscreen();
        }
    });
    
    // Fullscreen change handler to reset standard scaling calculations
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
             const frame = document.getElementById("canvas-frame");
             const rw = window.innerWidth;
             const rh = window.innerHeight;
             currentScale = Math.min(rw/800, rh/600);
             frame.style.transform = `scale(${currentScale * manualZoom})`;
        } else {
             resizeCanvas();
        }
    });

    // Export
    btnExport.addEventListener("click", () => {
        try {
            const dataURL = canvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
            const link = document.createElement("a");
            link.download = "vibe_design.png";
            link.href = dataURL;
            link.click();
            showToast("Design exported successfully!", "success");
        } catch (e) {
            showToast("Export failed. Make sure all assets are loaded securely.", "error");
            console.error(e);
        }
    });

    // Upload & Drag-Drop
    function addImageFile(file) {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            addImage(e.target.result, true);
            showToast("Added " + file.name);
        };
        reader.readAsDataURL(file);
    }

    uploadZone.addEventListener("click", () => fileInput.click());
    
    fileInput.addEventListener("change", (e) => {
        Array.from(e.target.files).forEach(addImageFile);
        fileInput.value = ""; // reset
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        canvasWorkspace.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    canvasWorkspace.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(addImageFile);
        }
    });

    // ── SMART LAYOUT (AI Features) ──────────────────────────────
    
    // 1. alignment guides & snapping
    const snapZone = 10;
    canvas.on('object:moving', function(e) {
        const obj = e.target;
        // Snap to center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        let cx = obj.left + obj.width * obj.scaleX / 2;
        let cy = obj.top + obj.height * obj.scaleY / 2;

        if (Math.abs(cx - centerX) < snapZone) {
            obj.set({ left: centerX - (obj.width * obj.scaleX / 2) });
        }
        if (Math.abs(cy - centerY) < snapZone) {
            obj.set({ top: centerY - (obj.height * obj.scaleY / 2) });
        }
    });

    btnSmartLayout.addEventListener("click", () => {
         // Auto-align vertically
         const objs = canvas.getObjects();
         if(objs.length === 0) return;
         
         const centerX = canvas.width / 2;
         let currentY = 50;
         objs.forEach(o => {
             o.set({
                 left: centerX - (o.width * o.scaleX / 2),
                 top: currentY
             });
             currentY += (o.height * o.scaleY) + 20;
         });
         canvas.renderAll();
         showToast("Smart Layout: Auto-centered elements", "success");
    });

    btnSmartColor.addEventListener("click", () => {
        // Theme color grading - changes all objects to match the requested light theme palette
        const palette = [THEME.primary, THEME.secondary, "#f3adc2", "#a8dadc", "#457b9d"];
        let colorIdx = 0;
        
        canvas.getObjects().forEach(o => {
            if(o.type === 'textbox') return; // skip text
            if(o.fill && typeof o.fill === 'string' && !o.fill.startsWith("url")) {
                o.set('fill', palette[colorIdx % palette.length]);
                colorIdx++;
            }
        });
        canvas.renderAll();
        showToast("Color Grading applied!", "success");
    });

    btnSmartWrap.addEventListener("click", () => {
         // Mock collision detection for Text wrapping
         const objs = canvas.getObjects();
         const texts = objs.filter(o => o.type === "textbox");
         const shapes = objs.filter(o => o.type !== "textbox" && o.type !== "image");
         
         if(texts.length && shapes.length) {
             const t = texts[0];
             const s = shapes[0];
             // Simple interaction: resize text to sit next to the shape
             t.set({
                 left: s.left + (s.width * s.scaleX) + 20,
                 width: canvas.width - (s.left + (s.width * s.scaleX) + 40)
             });
             canvas.renderAll();
             showToast("Smart Wrap: Relocated text dynamically", "success");
         } else {
             showToast("Need text and a shape to wrap.", "error");
         }
    });

    btnAiBgRemove.addEventListener("click", async () => {
         const obj = canvas.getActiveObject();
         if(!obj || obj.type !== 'image') {
             showToast("Select an image base first", "error");
             return;
         }
         if(!navigator.onLine) {
             showToast("Cannot use AI BG Remover offline.", "error");
             return;
         }

         showToast("Extracting object with YOLO...");
         // Converting fabric image to blob
         const dataURL = obj.toDataURL({format: 'png', multiplier: 1});
         const res = await fetch(dataURL);
         const blob = await res.blob();

         const fd = new FormData();
         fd.append("file", blob, "canvas_img.png");

         try {
             const apiRes = await fetch("/api/yolo-segment", { method: "POST", body: fd });
             if(!apiRes.ok) throw new Error("YOLO failed");
             const payload = await apiRes.json();
             
             // replace image
             fabric.Image.fromURL(payload.result.output_url, (newImg) => {
                 newImg.set({
                     left: obj.left, top: obj.top,
                     scaleX: obj.scaleX, scaleY: obj.scaleY
                 });
                 canvas.remove(obj);
                 canvas.add(newImg);
                 canvas.renderAll();
                 showToast("Background Removed!", "success");
             });

         } catch (e) {
             showToast(e.message, "error");
         }
    });

    // ── NETWORK STATUS ──────────────────────────────────────────
    function updateOnlineStatus() {
        if(navigator.onLine) {
            dot.className = "indicator-dot online";
            lbl.textContent = "Online";
            btnAiBgRemove.classList.remove("disabled");
        } else {
            dot.className = "indicator-dot offline";
            lbl.textContent = "Offline";
            btnAiBgRemove.classList.add("disabled");
            showToast("You are offline. AI tools deactivated.", "warning");
        }
    }
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus(); // initial

    // ── UTILS ───────────────────────────────────────────────────
    function showToast(msg, type="success") {
        const t = document.createElement("div");
        t.className = `toast toast-${type}`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 4000);
    }

    // INIT
    loadAssets();

})();
