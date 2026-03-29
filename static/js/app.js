/* static/js/app.js */
const app = {
    canvas: null,
    currentCategory: null,
    generatedCardData: null,
    activeClientId: null,
    activeClientData: null,
    assets: { shapes: [], templates: [] },
    fontsList: ['Arial', 'Times New Roman', 'system-ui', 'Courier New', 'Georgia', 'Verdana'],
    assetPaths: {
        shapes: '/static/assets/shapes',
        templates: '/static/assets/templates',
        fonts: '/static/assets/fonts'
    },

    init: function() {
        this.bindEvents();
        this.fetchClients();
        this.canvas = new fabric.Canvas('card-canvas', {
            backgroundColor: '#ffffff'
        });
        this.fetchAssets();
    },

    bindEvents: function() {
        document.querySelectorAll('.card-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.selectCategory(category);
            });
        });

        document.getElementById('card-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm();
        });

        document.getElementById('new-client-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitNewClient();
        });

        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            if (this.activeClientId) {
                window.open(`/api/clients/${this.activeClientId}/export/pdf`, '_blank');
            }
        });

        document.getElementById('btn-export-excel').addEventListener('click', () => {
            if (this.activeClientId) {
                window.open(`/api/clients/${this.activeClientId}/export/excel`, '_blank');
            }
        });

        document.getElementById('btn-edit').addEventListener('click', () => {
            const canvasState = this.canvas.toJSON();
            localStorage.setItem('vibe_transfer_canvas', JSON.stringify(canvasState));
            window.location.href = '/editor';
        });

        document.getElementById('btn-print').addEventListener('click', () => {
             this.printCard();
        });

        document.getElementById('btn-finish-edit').addEventListener('click', () => {
            document.getElementById('editor-panel').classList.add('hidden');
            this.canvas.discardActiveObject();
            this.canvas.renderAll();
        });

        document.getElementById('btn-add-text').addEventListener('click', () => {
            const text = document.getElementById('new-text').value;
            if(text) {
                const textObj = new fabric.IText(text, {
                    left: this.canvas.width / 2,
                    top: this.canvas.height / 2,
                    fontFamily: this.generatedCardData?.font || 'system-ui',
                    fill: document.getElementById('color-picker').value,
                    fontSize: 40,
                    originX: 'center',
                    originY: 'center'
                });
                this.canvas.add(textObj);
                this.canvas.setActiveObject(textObj);
                document.getElementById('new-text').value = '';
            }
        });

        document.getElementById('color-picker').addEventListener('change', (e) => {
            const activeObj = this.canvas.getActiveObject();
            if (activeObj && activeObj.fill) {
                if(activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox') {
                    activeObj.set({ fill: e.target.value });
                } else if(activeObj.type === 'path') {
                    activeObj.set({ fill: e.target.value });
                } else if (activeObj.type === 'group') {
                    const paths = activeObj.getObjects();
                    paths.forEach(p => {
                        if (p.fill) p.set({ fill: e.target.value });
                    });
                }
                this.canvas.renderAll();
            }
        });

        document.getElementById('btn-delete-obj').addEventListener('click', () => {
            const activeObj = this.canvas.getActiveObject();
            if(activeObj) {
                this.canvas.remove(activeObj);
            }
        });
    },

    async fetchClients() {
        try {
            const res = await fetch('/api/clients');
            if(res.ok) {
                const rs = await res.json();
                this.renderClientList(rs.data);
            }
        } catch(e) { console.warn("Failed to load clients.", e); }
    },

    renderClientList(clients) {
        const list = document.getElementById('client-list');
        list.innerHTML = '';
        clients.forEach(c => {
            const card = document.createElement('div');
            card.className = 'client-card glass-panel cursor-pointer';
            card.innerHTML = `
                <h3>${c.name}</h3>
                <p style="margin-top:0.5rem; opacity:0.8;">📞 ${c.phone}</p>
                <div style="margin-top:1rem; display:flex; gap:0.5rem; align-items:center;">
                    <button class="small-btn">View Profile</button>
                    ${c.id.substring(0,6)}
                </div>
            `;
            card.addEventListener('click', () => this.showClientProfile(c.id));
            list.appendChild(card);
        });
    },

    async submitNewClient() {
        const form = document.getElementById('new-client-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        try {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Saving...';
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if(res.ok) {
                form.reset();
                this.fetchClients();
                this.showView('view-dashboard');
            }
        } catch(e) { 
            console.error("Submit client failed", e); 
        } finally {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerText = 'Save Client';
        }
    },

    async showClientProfile(clientId) {
        this.activeClientId = clientId;
        try {
            const res = await fetch(`/api/clients/${clientId}`);
            if(res.ok) {
                const rs = await res.json();
                this.activeClientData = rs.data;
                document.getElementById('profile-name').innerText = rs.data.name;
                document.getElementById('profile-email').innerText = rs.data.email;
                document.getElementById('profile-phone').innerText = rs.data.phone;
                document.getElementById('profile-address').innerText = rs.data.address;
            }
            const pres = await fetch(`/api/clients/${clientId}/projects`);
            if (pres.ok) {
                const prs = await pres.json();
                this.renderProfileProjects(prs.data);
            }
            this.showView('view-client-profile');
        } catch(e) { console.error("Failed to load profile", e); }
    },

    renderProfileProjects(projects) {
        const list = document.getElementById('profile-projects-list');
        list.innerHTML = '';
        if(projects.length === 0) {
            list.innerHTML = '<p style="grid-column:1/-1;">No projects generated yet.</p>';
            return;
        }
        projects.forEach(p => {
             const div = document.createElement('div');
             div.className = 'project-card glass-panel cursor-pointer';
             div.innerHTML = `
                 <h4>${p.category.toUpperCase()}</h4>
                 <p style="font-size: 0.9em; opacity: 0.8; margin-top:5px;">${p.theme} Theme</p>
                 <p style="font-size: 0.8em; margin-top:10px;">Created: ${new Date(p.created_at).toLocaleDateString()}</p>
             `;
             div.addEventListener('click', () => {
                 // Re-render the saved metadata locally on the hidden canvas
                 this.renderCardOnCanvas(p.metadata, p.category);
                 // Serialize and transfer
                 const canvasState = this.canvas.toJSON();
                 localStorage.setItem('vibe_transfer_canvas', JSON.stringify(canvasState));
                 window.location.href = '/editor';
             });
             list.appendChild(div);
        });
    },

    startNewProject() {
        this.showView('view-category');
    },

    async fetchAssets() {
        try {
            const res = await fetch('/api/assets');
            if(res.ok) {
                const result = await res.json();
                this.assets = result.data;
                this.renderAssetLibrary();
            }
        } catch(e) {
            console.warn("Failed to fetch assets.", e);
        }

        try {
            const fontRes = await fetch('/api/fonts');
            if(fontRes.ok) {
                const result = await fontRes.json();
                if(result.data && result.data.length > 0) {
                    // merge with defaults uniquely
                    const downloadedFonts = result.data.filter(f => !this.fontsList.includes(f));
                    this.fontsList = [...this.fontsList, ...downloadedFonts];
                    
                    // Inject @font-face for each custom font
                    const styleNode = document.createElement('style');
                    let cssStr = '';
                    downloadedFonts.forEach(f => {
                         cssStr += `
                         @font-face {
                            font-family: '${f}';
                            src: url('/static/assets/fonts/${f}.ttf') format('truetype'),
                                 url('/static/assets/fonts/${f}.woff2') format('woff2');
                         }
                         `;
                    });
                    styleNode.innerHTML = cssStr;
                    document.head.appendChild(styleNode);
                }
            }
        } catch(e) {
            console.warn("Failed to fetch isolated fonts.", e);
        }
    },

    renderAssetLibrary: function() {
        const container = document.getElementById('asset-library-container');
        container.innerHTML = '';
        
        const allAssets = [];
        this.assets.shapes.forEach(f => allAssets.push({type: 'shapes', file: f}));
        this.assets.templates.forEach(f => allAssets.push({type: 'templates', file: f}));

        if(allAssets.length === 0) {
            container.innerHTML = '<p style="color:#666; font-size: 0.9rem;">No local assets found. Add files to assets folder.</p>';
            return;
        }

        allAssets.forEach(asset => {
            const btn = document.createElement('button');
            btn.className = 'asset-btn';
            btn.innerText = asset.file.length > 12 ? asset.file.substring(0,10) + '...' : asset.file;
            btn.title = asset.file;
            if(asset.type === 'templates') {
                btn.style.borderLeft = '4px solid var(--accent-color)';
            } else {
                btn.style.borderLeft = '4px solid var(--success)';
            }
            
            btn.addEventListener('click', () => {
                this.loadAssetToCanvas(asset.type, asset.file, 50, 50, 1);
            });
            container.appendChild(btn);
        });
    },

    showView: function(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active-view');
            v.classList.add('hidden');
        });
        const target = document.getElementById(viewId);
        target.classList.remove('hidden');
        target.classList.add('active-view');
        
        if (viewId !== 'view-preview') {
            document.getElementById('editor-panel').classList.add('hidden');
        }
    },

    selectCategory: function(category) {
        this.currentCategory = category;
        const titleMap = {
            wedding: "Wedding Card Details",
            birthday: "Birthday Card Details",
            business: "Business Card Details",
            greeting: "Greeting Card Details"
        };
        document.getElementById('form-title').innerText = titleMap[category];
        this.renderFormFields(category);
        this.showView('view-form');
    },

    renderFormFields: function(category) {
        const container = document.getElementById('dynamic-form-fields');
        container.innerHTML = '';
        
        let fields = [];
        // Layout Config
        fields.push({ name: 'theme', type: 'select', label: 'Theme', options: ['default', 'elegant', 'playful', 'professional', 'minimal'] });
        fields.push({ name: 'mood', type: 'select', label: 'Mood / Color Scheme', options: ['cool & calm', 'dark', 'light-soothing'] });
        fields.push({ name: 'font', type: 'select', label: 'Font', options: this.fontsList });
        fields.push({ name: 'style', type: 'select', label: 'Layout Style', options: ['classic', 'modern', 'vintage'] });
        fields.push({ name: 'alignment', type: 'select', label: 'Content Alignment', options: ['center', 'left', 'right', 'top', 'bottom'] });
        fields.push({ name: 'margin', type: 'number', label: 'Margin (px)', default: 40 });
        fields.push({ name: 'padding', type: 'number', label: 'Padding (px)', default: 20 });
        
        if (category === 'wedding') {
            fields.push(
                { name: 'groom_name', type: 'text', label: 'Groom Name', required: true },
                { name: 'bride_name', type: 'text', label: 'Bride Name', required: true },
                { name: 'date', type: 'date', label: 'Date', required: true },
                { name: 'time', type: 'time', label: 'Time', required: true },
                { name: 'venue', type: 'text', label: 'Venue Location', required: true }
            );
        } else if (category === 'birthday') {
            fields.push(
                { name: 'name', type: 'text', label: 'Name', required: true },
                { name: 'age', type: 'number', label: 'Turning Age', required: true },
                { name: 'date', type: 'date', label: 'Date', required: true },
                { name: 'time', type: 'time', label: 'Time', required: true },
                { name: 'venue', type: 'text', label: 'Venue', required: true }
            );
        } else if (category === 'business') {
            fields.push(
                { name: 'company_name', type: 'text', label: 'Company Name', required: true },
                { name: 'employee_name', type: 'text', label: 'Employee Name', required: true },
                { name: 'designation', type: 'text', label: 'Designation', required: true },
                { name: 'email', type: 'email', label: 'Email', required: true },
                { name: 'phone', type: 'tel', label: 'Phone', required: true },
                { name: 'website', type: 'text', label: 'Website (Optional)', required: false }
            );
        } else if (category === 'greeting') {
            fields.push(
                { name: 'recipient_name', type: 'text', label: 'To', required: true },
                { name: 'sender_name', type: 'text', label: 'From', required: true },
                { name: 'occasion', type: 'text', label: 'Occasion', required: true },
                { name: 'message', type: 'text', label: 'Message', required: true }
            );
        }

        fields.forEach(f => {
            const group = document.createElement('div');
            group.className = 'form-group';
            
            const label = document.createElement('label');
            label.innerText = f.label;
            group.appendChild(label);
            
            if (f.type === 'select') {
                const select = document.createElement('select');
                select.name = f.name;
                select.id = f.name;
                f.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt;
                    o.innerText = opt.charAt(0).toUpperCase() + opt.slice(1);
                    select.appendChild(o);
                });
                group.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = f.type;
                input.name = f.name;
                input.id = f.name;
                if(f.default !== undefined) input.value = f.default;
                if(f.required) input.required = true;
                group.appendChild(input);
            }
            container.appendChild(group);
        });
    },

    async submitForm() {
        const formElement = document.getElementById('card-form');
        const formData = new FormData(formElement);
        const data = { category: this.currentCategory };
        formData.forEach((value, key) => { 
            // handle integers
            if(key === 'margin' || key === 'padding' || key === 'age') {
                data[key] = parseInt(value) || 0;
            } else {
                data[key] = value; 
            }
        });

        try {
            const btn = formElement.querySelector('button[type="submit"]');
            btn.innerText = 'Predicting Structure...';
            btn.disabled = true;

            let apiUrl = `/api/generate/${this.currentCategory}`;
            if (this.activeClientId) {
                apiUrl += `?client_id=${this.activeClientId}`;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if(response.ok) {
                const result = await response.json();
                this.generatedCardData = result.data;
                this.renderCardOnCanvas(result.data, result.type);
                
                if (this.activeClientId) {
                    const pres = await fetch(`/api/clients/${this.activeClientId}/projects`);
                    const prs = await pres.json();
                    this.renderProfileProjects(prs.data);
                }

                alert(this.activeClientId ? "Project saved successfully to client profile!" : "Card generated successfully.");
                this.showView('view-preview');
            } else {
                alert('Error generating card. Check the inputs.');
                console.error(await response.text());
            }
        } catch (e) {
            console.error(e);
            alert('Failed to connect to the offline server.');
        } finally {
            const btn = formElement.querySelector('button[type="submit"]');
            btn.innerText = 'Generate Card ✨';
            btn.disabled = false;
        }
    },

    loadAssetToCanvas: function(assetType, fileName, left, top, scale = 1) {
        const assetUrl = `${this.assetPaths[assetType]}/${fileName}`;
        
        if(fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            fabric.Image.fromURL(assetUrl, (img) => {
                if(img) {
                    if(assetType === 'templates') {
                        const scaleX = this.canvas.width / img.width;
                        const scaleY = this.canvas.height / img.height;
                        const finalScale = Math.min(scaleX, scaleY);
                        
                        img.set({ 
                            left: (this.canvas.width - img.width * finalScale) / 2, 
                            top: (this.canvas.height - img.height * finalScale) / 2, 
                            scaleX: finalScale, 
                            scaleY: finalScale 
                        });
                        this.canvas.add(img);
                        this.canvas.sendToBack(img);
                    } else {
                        img.set({ left, top, scaleX: scale, scaleY: scale });
                        this.canvas.add(img);
                    }
                    this.canvas.renderAll();
                }
            });
        }
        else if (fileName.endsWith('.svg')) {
            fabric.loadSVGFromURL(assetUrl, (objects, options) => {
                const obj = fabric.util.groupSVGElements(objects, options);
                obj.set({ left, top, scaleX: scale, scaleY: scale });
                this.canvas.add(obj);
                this.canvas.renderAll();
            });
        }
    },

    renderCardOnCanvas: function(data, type) {
        this.canvas.clear();
        
        const fontToUse = data.font || 'system-ui';
        
        // --- MOOD ENGINE ---
        let bgColor = '#fdfdfd';
        let strokeColor = '#cbd5e1';
        let textColor = '#4a5568';
        let headingColor = '#1a202c';

        if(data.mood === 'cool & calm') {
            bgColor = '#e0f2fe';
            strokeColor = '#38bdf8';
            textColor = '#0f172a';
            headingColor = '#0c4a6e';
        } else if(data.mood === 'dark') {
            bgColor = '#1e293b';
            strokeColor = '#475569';
            textColor = '#f8fafc';
            headingColor = '#ffffff';
        } else if(data.mood === 'light-soothing') {
            bgColor = '#fdf2f8';
            strokeColor = '#fbcfe8';
            textColor = '#831843';
            headingColor = '#be185d';
        }

        this.canvas.backgroundColor = bgColor;
        
        // --- ALIGNMENT, MARGIN & PADDING ENGINE ---
        const margin = data.margin !== undefined ? data.margin : 40;
        const padding = data.padding !== undefined ? data.padding : 20;
        const align = data.alignment || 'center';
        
        const usableWidth = this.canvas.width - (margin * 2) - (padding * 2);
        
        // Start Y positioning map
        let startY = margin + padding + 10;
        if(align === 'center' || align === 'left' || align === 'right') {
             // For left/right/center overall block starts near middle-top
             startY = this.canvas.height / 3;
        } else if (align === 'bottom') {
             // Push to bottom visually
             startY = this.canvas.height - 300; 
        }

        let currentY = startY;

        // Using Textbox instead of IText to allow line-wrapping against margins!
        const heading = new fabric.Textbox(this._getMainHeading(data, type), {
            left: margin + padding, top: currentY,
            width: usableWidth,
            fontFamily: fontToUse,
            fontSize: 48,
            fontWeight: 'bold',
            fill: headingColor,
            textAlign: align === 'top' || align === 'bottom' ? 'center' : align
        });
        this.canvas.add(heading);
        currentY += heading.height + 20;

        const details = this._getDetailsList(data, type);
        details.forEach(detail => {
            const textObj = new fabric.Textbox(detail, {
                left: margin + padding, top: currentY,
                width: usableWidth,
                fontFamily: fontToUse,
                fontSize: 24,
                fill: textColor,
                textAlign: align === 'top' || align === 'bottom' ? 'center' : align
            });
            this.canvas.add(textObj);
            currentY += textObj.height + 15;
        });

        // --- STYLE ASSET ENGINE ---
        if(data.style === 'modern') {
            // Asymmetric layout logic
            const rect = new fabric.Rect({
                left: margin, top: margin,
                width: this.canvas.width - (margin*2), height: this.canvas.height - (margin*2),
                fill: 'transparent', stroke: strokeColor, strokeWidth: 8, rx: 0, ry: 0,
                selectable: false, evented: false
            });
            const accent = new fabric.Rect({
                 left: margin, top: margin, width: 20, height: this.canvas.height - (margin*2),
                 fill: strokeColor, selectable: false, evented: false
            });
            this.canvas.add(rect, accent);
            this.canvas.sendToBack(rect); this.canvas.sendToBack(accent);
        } else if (data.style === 'vintage') {
            // Double border layout
            const r1 = new fabric.Rect({
                left: margin, top: margin,
                width: this.canvas.width - (margin*2), height: this.canvas.height - (margin*2),
                fill: 'transparent', stroke: strokeColor, strokeWidth: 2, rx: 0, ry: 0, selectable: false, evented: false
            });
            const r2 = new fabric.Rect({
                left: margin+10, top: margin+10,
                width: this.canvas.width - (margin*2) - 20, height: this.canvas.height - (margin*2) - 20,
                fill: 'transparent', stroke: strokeColor, strokeWidth: 1, rx: 0, ry: 0, selectable: false, evented: false
            });
            this.canvas.add(r1, r2);
            this.canvas.sendToBack(r1); this.canvas.sendToBack(r2);
        } else {
            // classic rounded logic
            const rect = new fabric.Rect({
                left: margin, top: margin,
                width: this.canvas.width - (margin*2), height: this.canvas.height - (margin*2),
                fill: 'transparent', stroke: strokeColor, strokeWidth: 3, rx: 15, ry: 15,
                selectable: false, evented: false
            });
            this.canvas.add(rect);
            this.canvas.sendToBack(rect);
        }
    },

    _getMainHeading: function(data, type) {
        if(type === 'wedding') return `${data.groom_name} & ${data.bride_name}`;
        if(type === 'birthday') return `Happy ${data.age}${this._getOrdinal(data.age)} Birthday!`;
        if(type === 'business') return data.company_name;
        if(type === 'greeting') return `To ${data.recipient_name}`;
        return "Card";
    },

    _getDetailsList: function(data, type) {
        if(type === 'wedding') return [
            "We joyfully invite you to celebrate our union.",
            `Date: ${data.date} at ${data.time}`,
            `Venue: ${data.venue}`
        ];
        if(type === 'birthday') return [
            `Join us to celebrate ${data.name}'s Birthday!`,
            `Date: ${data.date} at ${data.time}`,
            `Location: ${data.venue}`
        ];
        if(type === 'business') return [
            data.employee_name,
            data.designation,
            `Email: ${data.email} | Phone: ${data.phone}`,
            data.website ? `URL: ${data.website}` : ""
        ];
        if(type === 'greeting') return [
             data.occasion,
             data.message,
             `From: ${data.sender_name}`
        ];
        return [];
    },

    _getOrdinal: function(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    },

    printCard: function() {
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        const dataUrl = this.canvas.toDataURL({ format: 'png', quality: 1.0 });
        const windowContent = `
            <!DOCTYPE html>
            <html>
            <head><title>Print Premium Card</title></head>
            <body onload="window.print(); window.close();" style="margin:0; text-align:center; padding-top: 2rem;">
                <img src="${dataUrl}" style="max-width:100%; height:auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
            </body>
            </html>
        `;
        const printWin = window.open('', '', 'width=900,height=700');
        printWin.document.open();
        printWin.document.write(windowContent);
        printWin.document.close();
    }
};

// Expose to global scope for inline HTML onclick handlers
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
