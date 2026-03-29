import os
import builtins
import io
import json
import uuid
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime

import aiofiles
from fpdf import FPDF
import pandas as pd
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi_offline import FastAPIOffline
import schemas

try:
    from ultralytics import YOLO
    # load small segmentation model
    yolo_model = YOLO("yolov8n-seg.pt")
except ImportError:
    yolo_model = None

# Ensure static and templates directories exist
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("static/assets/fonts", exist_ok=True)
os.makedirs("static/assets/shapes", exist_ok=True)
os.makedirs("static/assets/templates", exist_ok=True)
os.makedirs("static/vendor", exist_ok=True)
os.makedirs("templates", exist_ok=True)
os.makedirs("assets", exist_ok=True)
os.makedirs("data/clients", exist_ok=True)

app = FastAPIOffline()

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/editor", response_class=HTMLResponse)
async def editor_ui():
    html_path = Path("static/editor.html")
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Editor Not Found</h1>")

@app.post("/api/generate/wedding")
async def generate_wedding_card(form_data: schemas.WeddingCardForm, client_id: Optional[str] = Query(None)):
    data = form_data.model_dump()
    if client_id:
        await save_project(client_id, "wedding", data)
    return JSONResponse(content={"status": "success", "data": data, "type": "wedding"})

@app.post("/api/generate/birthday")
async def generate_birthday_card(form_data: schemas.BirthdayCardForm, client_id: Optional[str] = Query(None)):
    data = form_data.model_dump()
    if client_id:
        await save_project(client_id, "birthday", data)
    return JSONResponse(content={"status": "success", "data": data, "type": "birthday"})

@app.post("/api/generate/business")
async def generate_business_card(form_data: schemas.BusinessCardForm, client_id: Optional[str] = Query(None)):
    data = form_data.model_dump()
    if client_id:
        await save_project(client_id, "business", data)
    return JSONResponse(content={"status": "success", "data": data, "type": "business"})

@app.post("/api/generate/greeting")
async def generate_greeting_card(form_data: schemas.GreetingCardForm, client_id: Optional[str] = Query(None)):
    data = form_data.model_dump()
    if client_id:
        await save_project(client_id, "greeting", data)
    return JSONResponse(content={"status": "success", "data": data, "type": "greeting"})

async def save_project(client_id: str, category: str, data: dict):
    client_dir = Path("data/clients") / client_id
    if not client_dir.exists():
        return None
    project_id = str(uuid.uuid4().hex[:12])
    data["_project_id"] = project_id
    project_data = {
        "id": project_id,
        "client_id": client_id,
        "category": category,
        "theme": data.get("theme", "default"),
        "created_at": datetime.now().isoformat(),
        "metadata": data
    }
    project_path = client_dir / "projects" / f"{project_id}.json"
    async with aiofiles.open(project_path, mode="w", encoding="utf-8") as f:
        await f.write(json.dumps(project_data, indent=4))
    return project_data

@app.get("/api/clients")
async def list_clients():
    clients = []
    clients_dir = Path("data/clients")
    if clients_dir.exists():
        for client_id in os.listdir(clients_dir):
            profile_path = clients_dir / client_id / "profile.json"
            if profile_path.exists():
                async with aiofiles.open(profile_path, mode="r", encoding="utf-8") as f:
                    content = await f.read()
                    clients.append(json.loads(content))
    return JSONResponse(content={"status": "success", "data": clients})

@app.post("/api/clients")
async def create_client(client: schemas.ClientCreate):
    client_id = str(uuid.uuid4().hex[:12])
    client_dir = Path("data/clients") / client_id
    os.makedirs(client_dir / "projects", exist_ok=True)
    
    new_client = client.model_dump()
    new_client["id"] = client_id
    new_client["created_at"] = datetime.now().isoformat()
    
    profile_path = client_dir / "profile.json"
    async with aiofiles.open(profile_path, mode="w", encoding="utf-8") as f:
        await f.write(json.dumps(new_client, indent=4))
        
    return JSONResponse(content={"status": "success", "data": new_client})

@app.get("/api/clients/{client_id}")
async def get_client(client_id: str):
    profile_path = Path("data/clients") / client_id / "profile.json"
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Client not found")
        
    async with aiofiles.open(profile_path, mode="r", encoding="utf-8") as f:
        content = await f.read()
        return JSONResponse(content={"status": "success", "data": json.loads(content)})

@app.get("/api/clients/{client_id}/projects")
async def get_projects(client_id: str):
    projects = []
    projects_dir = Path("data/clients") / client_id / "projects"
    if projects_dir.exists():
        for project_file in os.listdir(projects_dir):
            if project_file.endswith(".json"):
                async with aiofiles.open(projects_dir / project_file, mode="r", encoding="utf-8") as f:
                    content = await f.read()
                    projects.append(json.loads(content))
    return JSONResponse(content={"status": "success", "data": projects})

@app.get("/api/clients/{client_id}/export/pdf")
async def export_pdf(client_id: str):
    client_dir = Path("data/clients") / client_id
    if not client_dir.exists():
        raise HTTPException(status_code=404, detail="Client not found")
    
    async with aiofiles.open(client_dir / "profile.json", mode="r", encoding="utf-8") as f:
        client = json.loads(await f.read())
        
    projects = []
    projects_dir = client_dir / "projects"
    if projects_dir.exists():
        for pf in os.listdir(projects_dir):
            if pf.endswith(".json"):
                async with aiofiles.open(projects_dir / pf, mode="r", encoding="utf-8") as f:
                    projects.append(json.loads(await f.read()))
                    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=16)
    pdf.cell(200, 10, txt=f"Client Profile: {client.get('name')}", ln=True, align="C")
    
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Email: {client.get('email')}", ln=True)
    pdf.cell(200, 10, txt=f"Phone: {client.get('phone')}", ln=True)
    pdf.cell(200, 10, txt=f"Address: {client.get('address')}", ln=True)
    pdf.cell(200, 10, txt="", ln=True)
    
    pdf.set_font("Arial", size=14)
    pdf.cell(200, 10, txt="Project History", ln=True)
    pdf.set_font("Arial", size=10)
    for p in projects:
        pdf.cell(200, 8, txt=f"Project ID: {p['id'].encode('latin-1', 'replace').decode('latin-1')} | Category: {p['category']} | Created: {p['created_at'][:10]}", ln=True)
        
    pdf_path = f"data/clients/{client_id}/export.pdf"
    pdf.output(pdf_path)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{client['name']}_Profile.pdf")

@app.get("/api/clients/{client_id}/export/excel")
async def export_excel(client_id: str):
    client_dir = Path("data/clients") / client_id
    if not client_dir.exists():
        raise HTTPException(status_code=404, detail="Client not found")
        
    projects = []
    projects_dir = client_dir / "projects"
    if projects_dir.exists():
        for pf in os.listdir(projects_dir):
            if pf.endswith(".json"):
                async with aiofiles.open(projects_dir / pf, mode="r", encoding="utf-8") as f:
                    projects.append(json.loads(await f.read()))
                    
    df = pd.DataFrame(projects)
    excel_path = f"data/clients/{client_id}/export.xlsx"
    df.to_excel(excel_path, index=False)
    
    return FileResponse(excel_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="Projects.xlsx")

@app.get("/api/assets")
async def get_assets():
    assets = {"shapes": [], "templates": []}
    shapes_dir = "static/assets/shapes"
    if os.path.exists(shapes_dir):
        assets["shapes"] = [f for f in os.listdir(shapes_dir) if os.path.isfile(os.path.join(shapes_dir, f))]
    templates_dir = "static/assets/templates"
    if os.path.exists(templates_dir):
        assets["templates"] = [f for f in os.listdir(templates_dir) if os.path.isfile(os.path.join(templates_dir, f))]
    return JSONResponse(content={"status": "success", "data": assets})

@app.get("/api/fonts")
async def get_fonts():
    fonts_dir = "static/assets/fonts"
    fonts_list = ["Arial", "Times New Roman", "system-ui"]
    if os.path.exists(fonts_dir):
        for f in os.listdir(fonts_dir):
            if f.endswith((".ttf", ".woff2")):
                fonts_list.append(f.rsplit(".", 1)[0])
    return JSONResponse(content={"status": "success", "data": fonts_list})

@app.get("/api/editor-assets")
async def editor_assets():
    """Scan the local assets folder to provide categorized elements to the smart editor."""
    assets_dir = Path("assets")
    categories = {
        "shapes": [],
        "icons": [],
        "ribbons": [],
        "stickers": [],
        "flowers": [],
        "people": [],
        "decorations": [],
        "fonts": [],
        "3d_models": []
    }
    
    if assets_dir.exists():
        for root, _, files in os.walk(assets_dir):
            for file in files:
                ext = Path(file).suffix.lower()
                rel_path = f"/assets/{Path(root).relative_to(assets_dir).as_posix()}/{file}"
                # Handle root level cases
                if rel_path.startswith('/assets/.'):
                    rel_path = f"/assets/{file}"

                folder_name = Path(root).name.lower()
                
                # GLB 3D Models
                if ext == ".glb":
                    categories["3d_models"].append(rel_path)
                elif ext in [".ttf", ".otf", ".woff"]:
                    categories["fonts"].append(rel_path)
                elif ext == ".svg":
                    if "shape" in folder_name:
                        categories["shapes"].append(rel_path)
                    elif "icon" in folder_name:
                        categories["icons"].append(rel_path)
                    else:
                        categories["shapes"].append(rel_path) # default
                elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
                    if "flower" in folder_name:
                        categories["flowers"].append(rel_path)
                    elif "people" in folder_name:
                        categories["people"].append(rel_path)
                    else:
                        categories["stickers"].append(rel_path)

    return JSONResponse(content={"status": "success", "data": categories})

@app.post("/api/yolo-segment")
async def yolo_segment(file: UploadFile = File(...)):
    """Automatic YOLOv8 instant isolation for the primary object."""
    if yolo_model is None:
        raise HTTPException(status_code=500, detail="Ultralytics YOLO is not installed.")

    img_bytes = await file.read()
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode the image.")

    results = yolo_model(img, verbose=False)
    result = results[0]

    if result.masks is None or len(result.masks) == 0:
        raise HTTPException(status_code=400, detail="YOLO did not detect any objects to segment.")

    # Find largest mask
    masks = result.masks.data.cpu().numpy()
    areas = [m.sum() for m in masks]
    best_idx = int(np.argmax(areas))
    mask = masks[best_idx]
    
    h, w = img.shape[:2]
    mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
    
    fg_mask = (mask * 255).astype(np.uint8)
    fg_mask = cv2.GaussianBlur(fg_mask, (5, 5), 0)
    _, fg_mask = cv2.threshold(fg_mask, 127, 255, cv2.THRESH_BINARY)

    img_rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    img_rgba[:, :, 3] = fg_mask

    success, buf = cv2.imencode(".png", img_rgba)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode output image.")
    
    # Save the asset
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    out_dir = Path("assets") / "stickers"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_name = f"{Path(file.filename).stem}_seg.png"
    out_path = out_dir / out_name
    out_path.write_bytes(buf.tobytes())

    return JSONResponse({
        "status": "success",
        "result": {
            "output_name": out_name,
            "output_url": f"/assets/stickers/{out_name}",
            "width": w,
            "height": h
        }
    })
