import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import io
import os
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import pandas as pd
import json

from .database import engine, Base, get_db
from .models import Job, AuditResult, Settings
from .schemas import JobSchema, JobDetailSchema, AuditResultSchema, SettingsSchema, ManualJobRequest
from .worker import worker_manager_loop, close_browser

# Initialize db schemas
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Website Audit Pipeline API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount screenshots static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Mount frontend production build if it exists
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")
    
    @app.get("/")
    def read_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# Startup background task worker loop
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(worker_manager_loop())

@app.on_event("shutdown")
async def shutdown_event():
    await close_browser()

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Calculate stats across all completed audits
    total_websites = db.query(AuditResult).count()
    completed = db.query(AuditResult).filter(AuditResult.status == 'Finished').count()
    running = db.query(AuditResult).filter(AuditResult.status.notin_(['Finished', 'Failed', 'Queued'])).count()
    failed = db.query(AuditResult).filter(AuditResult.status == 'Failed').count()
    
    # Average scores
    results = db.query(AuditResult).filter(AuditResult.status == 'Finished').all()
    avg_score = 0.0
    avg_seo = 0.0
    avg_perf = 0.0
    avg_a11y = 0.0
    avg_sec = 0.0
    avg_design = 0.0
    
    if results:
        avg_score = sum(r.score_overall for r in results) / len(results)
        avg_seo = sum(r.score_seo for r in results) / len(results)
        avg_perf = sum(r.score_performance for r in results) / len(results)
        avg_a11y = sum(r.score_accessibility for r in results) / len(results)
        avg_sec = sum(r.score_security for r in results) / len(results)
        avg_design = sum(r.score_design for r in results) / len(results)
        
    # Score distribution: counts in 90-100, 80-89, 70-79, 60-69, <60
    dist = {"Excellent": 0, "Good": 0, "Average": 0, "Poor": 0, "Critical": 0}
    for r in results:
        if r.score_overall >= 90: dist["Excellent"] += 1
        elif r.score_overall >= 80: dist["Good"] += 1
        elif r.score_overall >= 70: dist["Average"] += 1
        elif r.score_overall >= 60: dist["Poor"] += 1
        else: dist["Critical"] += 1
        
    # Top Issues aggregator
    issues_freq = {}
    for r in results:
        for issue in r.issues:
            prob = issue.get('problem')
            category = issue.get('category')
            issues_freq[(prob, category)] = issues_freq.get((prob, category), 0) + 1
            
    sorted_issues = sorted(issues_freq.items(), key=lambda item: item[1], reverse=True)[:5]
    top_issues = [{"problem": k[0], "category": k[1], "count": v} for k, v in sorted_issues]

    return {
        "total_websites": total_websites,
        "completed": completed,
        "running": running,
        "failed": failed,
        "average_score": round(avg_score, 1),
        "average_seo": round(avg_seo, 1),
        "average_perf": round(avg_perf, 1),
        "average_a11y": round(avg_a11y, 1),
        "average_sec": round(avg_sec, 1),
        "average_design": round(avg_design, 1),
        "score_distribution": dist,
        "top_issues": top_issues
    }

@app.post("/api/jobs/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    try:
        # Parse CSV
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        domain_col = next((col for col in df.columns if 'domain' in col.lower() or 'website' in col.lower() or 'url' in col.lower()), None)
        if not domain_col:
            raise HTTPException(status_code=400, detail="CSV must contain a 'domain' or 'website' column.")
        
        domains = df[domain_col].dropna().unique().tolist()
        if not domains:
            raise HTTPException(status_code=400, detail="No valid domains found in CSV.")

        # Create Job record
        job = Job(
            name=file.filename or "Uploaded Audit Job",
            total_websites=len(domains),
            status='running'
        )
        db.add(job)

        # Create Audit Results
        for domain in domains:
            res = AuditResult(
                job=job,
                domain=domain,
                status='Queued'
            )
            db.add(res)
        db.commit()

        return {"message": "CSV uploaded and job started successfully", "job_id": job.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

@app.post("/api/jobs/manual")
def create_manual_job(payload: ManualJobRequest, db: Session = Depends(get_db)):
    domains = [d.strip() for d in payload.domains if d.strip()]
    if not domains:
        raise HTTPException(status_code=400, detail="No valid domains provided.")

    # Create Job record
    job = Job(
        name=payload.name or "Manual Audit Job",
        total_websites=len(domains),
        status='running'
    )
    db.add(job)

    # Create Audit Results
    for domain in domains:
        # Normalize/clean up URL/domain if needed (just basic strip, worker handles resolving)
        res = AuditResult(
            job=job,
            domain=domain,
            status='Queued'
        )
        db.add(res)
    db.commit()

    return {"message": "Manual job started successfully", "job_id": job.id}



@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return jobs

@app.get("/api/jobs/{job_id}", response_model=JobDetailSchema)
def get_job_detail(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete screenshot files associated with this job's results from the disk
    for r in job.results:
        for suffix in ['_desktop.jpg', '_tablet.jpg', '_mobile.jpg']:
            filepath = os.path.join(STATIC_DIR, "screenshots", f"{r.id}{suffix}")
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"Error removing screenshot file {filepath}: {e}")
                    
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}

@app.get("/api/results")
def list_results(db: Session = Depends(get_db)):
    results = db.query(AuditResult).order_by(AuditResult.created_at.desc()).all()
    return results

@app.get("/api/results/{result_id}", response_model=AuditResultSchema)
def get_result_detail(result_id: int, db: Session = Depends(get_db)):
    res = db.query(AuditResult).filter(AuditResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Result not found")
    return res

@app.get("/api/jobs/{job_id}/export")
def export_job_results(job_id: int, format: str = "csv", db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    results = db.query(AuditResult).filter(AuditResult.job_id == job_id).all()
    data = []
    for r in results:
        critical_count = sum(1 for i in r.issues if i.get('severity') == 'High')
        warning_count = sum(1 for i in r.issues if i.get('severity') == 'Medium')
        
        data.append({
            "Domain": r.domain,
            "Overall Score": r.score_overall,
            "SEO": r.score_seo,
            "Performance": r.score_performance,
            "Accessibility": r.score_accessibility,
            "Security": r.score_security,
            "Design": r.score_design,
            "Responsive": r.score_responsive,
            "Total Issues": len(r.issues),
            "Critical Issues": critical_count,
            "Warnings": warning_count,
            "Status": r.status
        })
        
    df = pd.DataFrame(data)
    
    if format == "json":
        buffer = io.StringIO()
        df.to_json(buffer, orient="records", indent=2)
        return StreamingResponse(
            io.BytesIO(buffer.getvalue().encode('utf-8')),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=job_{job_id}_export.json"}
        )
    elif format == "excel":
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False, engine='openpyxl' if 'openpyxl' in pd.io.excel._encoders else None)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=job_{job_id}_export.xlsx"}
        )
    else: # default CSV
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        return StreamingResponse(
            io.BytesIO(buffer.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=job_{job_id}_export.csv"}
        )

@app.get("/api/settings", response_model=SettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@app.put("/api/settings", response_model=SettingsSchema)
def update_settings(payload: SettingsSchema, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
        
    settings.concurrency = payload.concurrency
    settings.timeout = payload.timeout
    settings.retry_count = payload.retry_count
    settings.screenshot_resolution_desktop = payload.screenshot_resolution_desktop
    settings.dark_mode = payload.dark_mode
    settings.export_format = payload.export_format
    
    db.commit()
    db.refresh(settings)
    return settings
