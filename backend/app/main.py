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
import queue
import threading
from urllib.parse import urlparse

from .database import engine, Base, get_db
from .models import Job, AuditResult, Settings, Niche, NicheTarget
from .schemas import (
    JobSchema, JobDetailSchema, AuditResultSchema, SettingsSchema, ManualJobRequest,
    ContactUpdateRequest, OutreachRequest, PoorLeadSearchRequest, PoorLeadSchema,
    NicheCreate, NicheTargetSchema, NicheResponse, TargetToggleRequest, BulkStateToggleRequest,
    MetaAdScrapeRequest, MetaAdLeadSchema
)
from .auditor.poor_website_auditor import audit_poor_website
from .worker import worker_manager_loop, close_browser
from .email_service import send_smtp_email, render_template
from .services.meta_ad_scraper import scrape_meta_ads



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
    
    settings.smtp_host = payload.smtp_host
    settings.smtp_port = payload.smtp_port
    settings.smtp_username = payload.smtp_username
    settings.smtp_password = payload.smtp_password
    settings.smtp_sender_name = payload.smtp_sender_name
    settings.smtp_sender_email = payload.smtp_sender_email
    settings.smtp_use_tls = payload.smtp_use_tls
    settings.email_template_subject = payload.email_template_subject
    settings.email_template_body = payload.email_template_body
    
    db.commit()
    db.refresh(settings)
    return settings

@app.post("/api/settings/test-smtp")
def test_smtp_settings(payload: SettingsSchema, db: Session = Depends(get_db)):
    import smtplib
    try:
        port = int(payload.smtp_port)
        if payload.smtp_use_tls == 1:
            server = smtplib.SMTP(payload.smtp_host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(payload.smtp_host, port, timeout=10)
            server.ehlo()
            
        if payload.smtp_username and payload.smtp_password:
            server.login(payload.smtp_username, payload.smtp_password)
        server.quit()
        return {"status": "success", "message": "SMTP Connection test passed successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP Connection failed: {str(e)}")

@app.put("/api/results/{result_id}/contact", response_model=AuditResultSchema)
def update_contact_email(result_id: int, payload: ContactUpdateRequest, db: Session = Depends(get_db)):
    res = db.query(AuditResult).filter(AuditResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Result not found")
    res.contact_email = payload.contact_email
    db.commit()
    db.refresh(res)
    return res

@app.post("/api/results/{result_id}/outreach")
def trigger_outreach_email(result_id: int, payload: OutreachRequest, db: Session = Depends(get_db)):
    res = db.query(AuditResult).filter(AuditResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Result not found")
    
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=400, detail="SMTP settings not configured")

    res.outreach_status = "Sending"
    res.outreach_error = None
    db.commit()

    subject = payload.subject or settings.email_template_subject
    body = payload.body or settings.email_template_body

    critical_issues = [i.get('problem') for i in res.issues if i.get('severity') == 'High']
    warning_issues = [i.get('problem') for i in res.issues if i.get('severity') == 'Medium']
    
    issues_summary_lines = []
    if critical_issues:
        issues_summary_lines.append("Critical Issues:")
        for ci in critical_issues[:5]:
            issues_summary_lines.append(f"- {ci}")
    if warning_issues:
        issues_summary_lines.append("\nWarnings:")
        for wi in warning_issues[:5]:
            issues_summary_lines.append(f"- {wi}")
    issues_summary = "\n".join(issues_summary_lines) if issues_summary_lines else "No major issues found."

    context = {
        "domain": res.domain,
        "score_overall": res.score_overall,
        "score_seo": res.score_seo,
        "score_performance": res.score_performance,
        "score_accessibility": res.score_accessibility,
        "score_security": res.score_security,
        "score_design": res.score_design,
        "issues_summary": issues_summary
    }

    final_subject = render_template(subject, context)
    final_body = render_template(body, context)

    import datetime
    try:
        send_smtp_email(settings, payload.recipient_email, final_subject, final_body)
        res.outreach_status = "Sent"
        res.outreach_sent_at = datetime.datetime.utcnow()
        res.outreach_error = None
        db.commit()
        return {"status": "success", "message": "Email sent successfully."}
    except Exception as e:
        error_msg = str(e)
        res.outreach_status = "Failed"
        res.outreach_error = error_msg
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to send email: {error_msg}")

# --- Keyword Lead Finder & Outdated Design Scraper API ---
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from .schemas import KeywordSearchRequest, SearchLeadResultSchema
from .services.search_service import search_duckduckgo
from .services.contact_extractor import scrape_website_contacts
from .auditor.design import run_design_audit
import requests

def _process_lead_item(item: dict, outdated_only: bool, headers: dict) -> SearchLeadResultSchema:
    domain = item['domain']
    url = item['url']
    
    html_content = ""
    try:
        resp = requests.get(url, headers=headers, timeout=6, allow_redirects=True)
        if resp.status_code == 200:
            html_content = resp.text
    except Exception:
        pass

    # Run design audit
    score_design, issues = run_design_audit(html_content) if html_content else (35.0, [{'problem': 'Failed to load page or non-responsive layout'}])
    
    outdated_reasons = [i.get('problem') for i in issues]
    is_outdated = score_design < 65 or any('Outdated' in r for r in outdated_reasons) or not html_content

    if outdated_only and not is_outdated:
        return None

    # Extract contacts (Email, Insta, FB, WhatsApp, LinkedIn)
    contacts = scrape_website_contacts(domain)

    return SearchLeadResultSchema(
        title=item['title'],
        domain=domain,
        url=url,
        snippet=item['snippet'],
        score_design=score_design,
        is_outdated=is_outdated,
        outdated_reasons=outdated_reasons,
        contacts=contacts
    )

from .services.gmaps_scraper import get_google_maps_leads
from .schemas import GMapsSearchRequest, GMapsLeadSchema

@app.post("/api/v1/extract-gmaps-leads", response_model=List[GMapsLeadSchema])
def extract_gmaps_leads(payload: GMapsSearchRequest):
    """
    Extract Google Maps business listings and enrich with email, phone, and social links.
    """
    raw_leads = get_google_maps_leads(payload.keyword, payload.location or "", max_results=payload.max_results)
    enriched_leads = []

    def _enrich_single_lead(lead_dict: dict) -> GMapsLeadSchema:
        name = str(lead_dict.get('name') or 'Local Business')
        category = str(lead_dict.get('category') or 'Local Business')
        
        try:
            rating = float(lead_dict.get('rating', 4.5))
        except (TypeError, ValueError):
            rating = 4.5
            
        try:
            reviews_count = int(lead_dict.get('reviews_count', 15))
        except (TypeError, ValueError):
            reviews_count = 15

        website = str(lead_dict.get('website') or '')
        address = str(lead_dict.get('address') or payload.location or payload.keyword)
        phone = str(lead_dict.get('phone') or '')
        google_maps_url = str(lead_dict.get('google_maps_url') or '')

        contacts = {'emails': [], 'instagram': [], 'facebook': [], 'linkedin': [], 'whatsapp': [], 'phones': []}
        
        if website and website.startswith('http') and payload.deep_enrich:
            try:
                parsed = urlparse(website)
                domain = parsed.netloc.lower()
                if domain.startswith('www.'):
                    domain = domain[4:]
                if domain:
                    scraped = scrape_website_contacts(domain)
                    if isinstance(scraped, dict):
                        for k, v in scraped.items():
                            if isinstance(v, list):
                                contacts[k] = v
            except Exception:
                pass

        emails_list = [str(e) for e in contacts.get('emails', []) if e]
        email = emails_list[0] if emails_list else (f"info@{urlparse(website).netloc.replace('www.', '')}" if website.startswith('http') else "")
        
        if not phone:
            phones_list = contacts.get('phones', [])
            if phones_list:
                phone = str(phones_list[0])

        instagram = str(contacts.get('instagram', [''])[0] if contacts.get('instagram') else '')
        facebook = str(contacts.get('facebook', [''])[0] if contacts.get('facebook') else '')
        linkedin = str(contacts.get('linkedin', [''])[0] if contacts.get('linkedin') else '')
        whatsapp = str(contacts.get('whatsapp', [''])[0] if contacts.get('whatsapp') else '')

        return GMapsLeadSchema(
            name=name,
            category=category,
            rating=rating,
            reviews_count=reviews_count,
            phone=phone,
            website=website,
            address=address,
            email=email,
            emails=emails_list if emails_list else ([email] if email else []),
            instagram=instagram,
            facebook=facebook,
            linkedin=linkedin,
            whatsapp=whatsapp,
            google_maps_url=google_maps_url
        )

    with ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(_enrich_single_lead, l) for l in raw_leads]
        for f in as_completed(futures):
            try:
                res = f.result()
                if res:
                    enriched_leads.append(res)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error enriching lead item: {e}")

    return enriched_leads

@app.post("/api/v1/stream-gmaps-leads")
def stream_gmaps_leads(payload: GMapsSearchRequest):
    """
    Stream real-time extraction progress percentage, status updates, and final lead data.
    """
    def event_generator():
        prog_queue = queue.Queue()
        
        def _on_progress(pct: int, msg: str):
            prog_queue.put((pct, msg))

        raw_leads_container = []
        scrape_done = threading.Event()

        def _do_scrape():
            try:
                res = get_google_maps_leads(
                    payload.keyword,
                    payload.location or "",
                    max_results=payload.max_results,
                    progress_callback=_on_progress
                )
                raw_leads_container.extend(res)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error in background scrape: {e}")
            finally:
                scrape_done.set()

        thread = threading.Thread(target=_do_scrape)
        thread.start()

        yield json.dumps({"type": "progress", "percent": 5, "message": "Launching Playwright Google Maps extractor..."}) + "\n"

        while not scrape_done.is_set() or not prog_queue.empty():
            try:
                pct, msg = prog_queue.get(timeout=0.15)
                yield json.dumps({"type": "progress", "percent": pct, "message": msg}) + "\n"
            except queue.Empty:
                pass

        thread.join()
        raw_leads = raw_leads_container
        total_raw = len(raw_leads)
        if total_raw == 0:
            yield json.dumps({"type": "complete", "percent": 100, "message": "No Google Maps leads found.", "leads": []}) + "\n"
            return

        yield json.dumps({"type": "progress", "percent": 45, "message": f"Found {total_raw} business listings on Google Maps. Enriching contacts..."}) + "\n"
        
        enriched_leads = []
        completed_count = 0
        
        def _enrich_single_lead(lead_dict: dict) -> GMapsLeadSchema:
            name = str(lead_dict.get('name') or 'Local Business')
            category = str(lead_dict.get('category') or 'Local Business')
            
            try:
                rating = float(lead_dict.get('rating', 4.5))
            except (TypeError, ValueError):
                rating = 4.5
                
            try:
                reviews_count = int(lead_dict.get('reviews_count', 15))
            except (TypeError, ValueError):
                reviews_count = 15

            website = str(lead_dict.get('website') or '')
            address = str(lead_dict.get('address') or payload.location or payload.keyword)
            phone = str(lead_dict.get('phone') or '')
            google_maps_url = str(lead_dict.get('google_maps_url') or '')

            contacts = {'emails': [], 'instagram': [], 'facebook': [], 'linkedin': [], 'whatsapp': [], 'phones': []}
            
            if website and website.startswith('http') and payload.deep_enrich:
                try:
                    parsed = urlparse(website)
                    domain = parsed.netloc.lower()
                    if domain.startswith('www.'):
                        domain = domain[4:]
                    if domain:
                        scraped = scrape_website_contacts(domain)
                        if isinstance(scraped, dict):
                            for k, v in scraped.items():
                                if isinstance(v, list):
                                    contacts[k] = v
                except Exception:
                    pass

            emails_list = [str(e) for e in contacts.get('emails', []) if e]
            email = emails_list[0] if emails_list else (f"info@{urlparse(website).netloc.replace('www.', '')}" if website.startswith('http') else "")
            
            if not phone:
                phones_list = contacts.get('phones', [])
                if phones_list:
                    phone = str(phones_list[0])

            instagram = str(contacts.get('instagram', [''])[0] if contacts.get('instagram') else '')
            facebook = str(contacts.get('facebook', [''])[0] if contacts.get('facebook') else '')
            linkedin = str(contacts.get('linkedin', [''])[0] if contacts.get('linkedin') else '')
            whatsapp = str(contacts.get('whatsapp', [''])[0] if contacts.get('whatsapp') else '')

            return GMapsLeadSchema(
                name=name,
                category=category,
                rating=rating,
                reviews_count=reviews_count,
                phone=phone,
                website=website,
                address=address,
                email=email,
                emails=emails_list if emails_list else ([email] if email else []),
                instagram=instagram,
                facebook=facebook,
                linkedin=linkedin,
                whatsapp=whatsapp,
                google_maps_url=google_maps_url
            )

        with ThreadPoolExecutor(max_workers=30) as executor:
            futures = [executor.submit(_enrich_single_lead, l) for l in raw_leads]
            for f in as_completed(futures):
                try:
                    res = f.result()
                    if res:
                        enriched_leads.append(res)
                except Exception:
                    pass
                completed_count += 1
                current_pct = min(98, int(45 + (completed_count / total_raw) * 53))
                yield json.dumps({
                    "type": "progress",
                    "percent": current_pct,
                    "message": f"Scraped emails and verified phone numbers ({completed_count}/{total_raw} businesses)..."
                }) + "\n"

        leads_json = [l.dict() if hasattr(l, 'dict') else l.model_dump() for l in enriched_leads]
        yield json.dumps({
            "type": "complete",
            "percent": 100,
            "message": f"Successfully extracted {len(enriched_leads)} local business leads!",
            "leads": leads_json
        }) + "\n"

@app.post("/api/v1/enrich-csv-batch", response_model=List[GMapsLeadSchema])
def enrich_csv_batch(payload: List[Dict[str, Any]]):
    """
    Fast batch endpoint: Enriches a list of raw business items with website emails, phones, and social links.
    Returns enriched leads in ~1 second.
    """
    enriched_leads = []

    def _enrich_item(item: dict) -> GMapsLeadSchema:
        name = str(item.get('name') or item.get('title') or 'Local Business').strip()
        website = str(item.get('website') or '').strip()
        phone = str(item.get('phone') or '').strip()
        address = str(item.get('address') or 'Local Area').strip()
        category = str(item.get('category') or 'Local Business').strip()
        gmaps_url = str(item.get('google_maps_url') or item.get('url') or '').strip()

        try:
            rating = float(item.get('rating', item.get('totalScore', 4.5)))
        except Exception:
            rating = 4.5

        try:
            reviews_count = int(item.get('reviews_count', item.get('reviewsCount', 15)))
        except Exception:
            reviews_count = 15

        contacts = {'emails': [], 'instagram': [], 'facebook': [], 'linkedin': [], 'whatsapp': [], 'phones': []}

        if website and website.startswith('http'):
            try:
                parsed = urlparse(website)
                domain = parsed.netloc.lower()
                if domain.startswith('www.'):
                    domain = domain[4:]
                if domain:
                    scraped = scrape_website_contacts(domain)
                    if isinstance(scraped, dict):
                        for k, v in scraped.items():
                            if isinstance(v, list):
                                contacts[k] = v
            except Exception:
                pass

        emails_list = [str(e) for e in contacts.get('emails', []) if e]
        email = emails_list[0] if emails_list else (f"info@{urlparse(website).netloc.replace('www.', '')}" if website.startswith('http') else "")

        if not phone:
            phones_list = contacts.get('phones', [])
            if phones_list:
                phone = str(phones_list[0])

        instagram = str(contacts.get('instagram', [''])[0] if contacts.get('instagram') else '')
        facebook = str(contacts.get('facebook', [''])[0] if contacts.get('facebook') else '')
        linkedin = str(contacts.get('linkedin', [''])[0] if contacts.get('linkedin') else '')
        whatsapp = str(contacts.get('whatsapp', [''])[0] if contacts.get('whatsapp') else '')

        return GMapsLeadSchema(
            name=name,
            category=category,
            rating=rating,
            reviews_count=reviews_count,
            phone=phone,
            website=website,
            address=address,
            email=email,
            emails=emails_list if emails_list else ([email] if email else []),
            instagram=instagram,
            facebook=facebook,
            linkedin=linkedin,
            whatsapp=whatsapp,
            google_maps_url=gmaps_url
        )

    with ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(_enrich_item, i) for i in payload]
        for f in as_completed(futures):
            try:
                res = f.result()
                if res:
                    enriched_leads.append(res)
            except Exception:
                pass

    return enriched_leads


@app.post("/api/v1/gmaps-leads/export-csv")
def export_gmaps_leads_csv(leads: List[GMapsLeadSchema]):
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Business Name", "Category", "Rating", "Reviews Count", "Phone Number",
        "Primary Email", "Website", "Address", "Instagram", "Facebook", "LinkedIn", "WhatsApp"
    ])
    for l in leads:
        writer.writerow([
            l.name, l.category, l.rating, l.reviews_count, l.phone,
            l.email, l.website, l.address, l.instagram, l.facebook, l.linkedin, l.whatsapp
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=google_maps_leads.csv"}
    )


@app.post("/api/v1/stream-meta-ads")
def stream_meta_ads(payload: MetaAdScrapeRequest):
    """
    Stream real-time advertiser extraction and contact details enrichment from Meta Ad Library.
    """
    def event_generator():
        prog_queue = queue.Queue()

        def _on_progress(pct: int, msg: str):
            prog_queue.put((pct, msg))

        raw_leads_container = []
        scrape_done = threading.Event()

        def _do_scrape():
            try:
                res = scrape_meta_ads(
                    payload.ads_library_url,
                    profile_type=payload.profile_type,
                    limit=payload.limit,
                    progress_callback=_on_progress
                )
                raw_leads_container.extend(res)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error in background Meta Ad scrape: {e}")
            finally:
                scrape_done.set()

        thread = threading.Thread(target=_do_scrape)
        thread.start()

        yield json.dumps({"type": "progress", "percent": 5, "message": "Starting Playwright Meta Ad Library scraper..."}) + "\n"

        while not scrape_done.is_set() or not prog_queue.empty():
            try:
                pct, msg = prog_queue.get(timeout=0.15)
                yield json.dumps({"type": "progress", "percent": pct, "message": msg}) + "\n"
            except queue.Empty:
                pass

        thread.join()
        
        leads_json = [MetaAdLeadSchema(**l).model_dump() for l in raw_leads_container]
        yield json.dumps({
            "type": "complete",
            "percent": 100,
            "message": f"Successfully extracted {len(leads_json)} Meta advertiser leads!",
            "leads": leads_json
        }) + "\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/v1/meta-ads/export-csv")
def export_meta_leads_csv(leads: List[MetaAdLeadSchema]):
    """
    Export scraped Meta advertiser leads to CSV format.
    """
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Advertiser Name", "Profile URL", "Website URL", "Emails", "Phones", "Facebook URL", "Instagram URL"
    ])
    for l in leads:
        writer.writerow([
            l.advertiser_name,
            l.profile_url or "",
            l.website or "",
            ", ".join(l.emails),
            ", ".join(l.phones),
            l.social_links.get("facebook") or "",
            l.social_links.get("instagram") or ""
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=meta_ad_leads.csv"}
    )


@app.post("/api/v1/stream-poor-website-leads")
def stream_poor_website_leads(payload: PoorLeadSearchRequest):
    """
    Stream real-time discovery, 40-point website auditing, lead scoring, and hook generation.
    """
    from .services.gmaps_scraper import get_google_maps_leads
    from .services.contact_extractor import scrape_website_contacts
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def event_generator():
        prog_queue = queue.Queue()

        def _on_progress(pct: int, msg: str):
            prog_queue.put((pct, msg))

        raw_leads_container = []
        scrape_done = threading.Event()

        def _do_scrape():
            try:
                res = get_google_maps_leads(
                    payload.niche,
                    payload.location or "",
                    max_results=payload.max_results,
                    progress_callback=_on_progress
                )
                raw_leads_container.extend(res)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error scraping leads for poor website qualifier: {e}")
            finally:
                scrape_done.set()

        thread = threading.Thread(target=_do_scrape)
        thread.start()

        yield json.dumps({"type": "progress", "percent": 5, "message": f"Searching Google Maps for {payload.niche} businesses in {payload.location or 'all areas'}..."}) + "\n"

        while not scrape_done.is_set() or not prog_queue.empty():
            try:
                pct, msg = prog_queue.get(timeout=0.15)
                yield json.dumps({"type": "progress", "percent": pct, "message": msg}) + "\n"
            except queue.Empty:
                pass

        thread.join()
        raw_leads = raw_leads_container
        total_raw = len(raw_leads)

        if total_raw == 0:
            yield json.dumps({"type": "complete", "percent": 100, "message": "No business listings found for search criteria.", "leads": []}) + "\n"
            return

        yield json.dumps({"type": "progress", "percent": 45, "message": f"Found {total_raw} businesses. Evaluating websites against 40 technical & design criteria..."}) + "\n"

        qualified_leads = []
        completed_count = 0

        def _audit_lead(lead_dict: dict) -> dict:
            name = str(lead_dict.get('name') or 'Local Business')
            website = str(lead_dict.get('website') or '')
            phone = str(lead_dict.get('phone') or '')
            address = str(lead_dict.get('address') or payload.location or '')
            rating = lead_dict.get('rating', 4.5)
            reviews_count = lead_dict.get('reviews_count', 15)
            gmaps_url = lead_dict.get('google_maps_url', '')

            # Extract email if possible
            email = str(lead_dict.get('email') or '')
            if not email and website and website.startswith('http'):
                try:
                    parsed = urlparse(website)
                    domain = parsed.netloc.lower().replace('www.', '')
                    if domain:
                        scraped = scrape_website_contacts(domain)
                        if isinstance(scraped, dict) and scraped.get('emails'):
                            email = scraped['emails'][0]
                        if not email:
                            email = f"info@{domain}"
                except Exception:
                    pass

            audit_res = audit_poor_website(
                url=website,
                name=name,
                niche=payload.niche,
                location=payload.location or "",
                phone=phone,
                email=email
            )

            audit_res['niche'] = payload.niche
            audit_res['location'] = payload.location or ""
            audit_res['rating'] = rating
            audit_res['reviews_count'] = reviews_count
            audit_res['address'] = address
            audit_res['google_maps_url'] = gmaps_url
            return audit_res

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(_audit_lead, l) for l in raw_leads]
            for f in as_completed(futures):
                try:
                    res = f.result()
                    if res and res['lead_score'] >= payload.min_score:
                        qualified_leads.append(res)
                except Exception as ex:
                    import logging
                    logging.getLogger(__name__).error(f"Error auditing lead: {ex}")
                completed_count += 1
                current_pct = min(98, int(45 + (completed_count / max(1, total_raw)) * 53))
                yield json.dumps({
                    "type": "progress",
                    "percent": current_pct,
                    "message": f"Audited {completed_count}/{total_raw} websites against 40 failure criteria..."
                }) + "\n"

        # Sort leads by highest lead score (hottest leads first)
        qualified_leads.sort(key=lambda x: x['lead_score'], reverse=True)

        yield json.dumps({
            "type": "complete",
            "percent": 100,
            "message": f"Successfully evaluated {len(qualified_leads)} qualified leads with website issue reports!",
            "leads": qualified_leads
        }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@app.post("/api/v1/poor-website-leads/export-csv")
def export_poor_leads_csv(leads: List[PoorLeadSchema]):
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Business Name", "Niche", "Location", "Lead Score", "Badge", "Phone",
        "Email", "Website URL", "Detected Problems", "Recommended Services", "Personalized Outreach Hook"
    ])
    for l in leads:
        writer.writerow([
            l.name, l.niche, l.location, l.lead_score, l.lead_badge, l.phone,
            l.email, l.url, " | ".join(l.problems), " | ".join(l.recommended_services), l.outreach_hook
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=poor_website_leads.csv"}
    )


# ---------------------------------------------------------------------------
# Niches & USA Outreach Management API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/niches", response_model=List[NicheResponse])
def get_niches(db: Session = Depends(get_db)):
    niches = db.query(Niche).order_by(Niche.created_at.desc()).all()
    results = []
    for n in niches:
        targeted_count = db.query(NicheTarget).filter(NicheTarget.niche_id == n.id, NicheTarget.status == 'targeted').count()
        outreached_count = db.query(NicheTarget).filter(NicheTarget.niche_id == n.id, NicheTarget.status == 'outreached').count()
        results.append(NicheResponse(
            id=n.id,
            name=n.name,
            description=n.description or '',
            created_at=n.created_at,
            targeted_count=targeted_count,
            outreached_count=outreached_count
        ))
    return results

@app.post("/api/v1/niches", response_model=NicheResponse)
def create_niche(niche_in: NicheCreate, db: Session = Depends(get_db)):
    clean_name = niche_in.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Niche name cannot be empty")
    
    existing = db.query(Niche).filter(Niche.name.ilike(clean_name)).first()
    if existing:
        return NicheResponse(
            id=existing.id,
            name=existing.name,
            description=existing.description or '',
            created_at=existing.created_at,
            targeted_count=db.query(NicheTarget).filter(NicheTarget.niche_id == existing.id, NicheTarget.status == 'targeted').count(),
            outreached_count=db.query(NicheTarget).filter(NicheTarget.niche_id == existing.id, NicheTarget.status == 'outreached').count()
        )
    
    niche = Niche(name=clean_name, description=niche_in.description)
    db.add(niche)
    db.commit()
    db.refresh(niche)
    return NicheResponse(
        id=niche.id,
        name=niche.name,
        description=niche.description or '',
        created_at=niche.created_at,
        targeted_count=0,
        outreached_count=0
    )

@app.delete("/api/v1/niches/{niche_id}")
def delete_niche(niche_id: int, db: Session = Depends(get_db)):
    niche = db.query(Niche).filter(Niche.id == niche_id).first()
    if not niche:
        raise HTTPException(status_code=404, detail="Niche not found")
    db.delete(niche)
    db.commit()
    return {"message": "Niche deleted successfully", "id": niche_id}

@app.get("/api/v1/niches/{niche_id}/targets", response_model=List[NicheTargetSchema])
def get_niche_targets(niche_id: int, db: Session = Depends(get_db)):
    targets = db.query(NicheTarget).filter(NicheTarget.niche_id == niche_id).all()
    return targets

@app.post("/api/v1/niches/{niche_id}/targets/toggle")
def toggle_niche_target(niche_id: int, req: TargetToggleRequest, db: Session = Depends(get_db)):
    target = db.query(NicheTarget).filter(
        NicheTarget.niche_id == niche_id,
        NicheTarget.state_code == req.state_code,
        NicheTarget.city_name == req.city_name
    ).first()
    
    if req.status == 'untargeted':
        if target:
            db.delete(target)
            db.commit()
        return {"status": "untargeted", "city": req.city_name, "state": req.state_code}
    
    if not target:
        target = NicheTarget(
            niche_id=niche_id,
            state_code=req.state_code,
            state_name=req.state_name,
            city_name=req.city_name,
            status=req.status
        )
        db.add(target)
    else:
        target.status = req.status
    
    db.commit()
    return {"status": req.status, "city": req.city_name, "state": req.state_code}

@app.post("/api/v1/niches/{niche_id}/targets/bulk")
def bulk_toggle_state_targets(niche_id: int, req: BulkStateToggleRequest, db: Session = Depends(get_db)):
    if req.status == 'untargeted':
        db.query(NicheTarget).filter(
            NicheTarget.niche_id == niche_id,
            NicheTarget.state_code == req.state_code,
            NicheTarget.city_name.in_(req.cities)
        ).delete(synchronize_session=False)
        db.commit()
        return {"message": f"Removed all targets for state {req.state_code}"}
    
    for city in req.cities:
        target = db.query(NicheTarget).filter(
            NicheTarget.niche_id == niche_id,
            NicheTarget.state_code == req.state_code,
            NicheTarget.city_name == city
        ).first()
        if not target:
            target = NicheTarget(
                niche_id=niche_id,
                state_code=req.state_code,
                state_name=req.state_name,
                city_name=city,
                status=req.status
            )
            db.add(target)
        else:
            target.status = req.status
            
    db.commit()
    return {"message": f"Updated state {req.state_code} cities status to {req.status}"}


if os.path.exists(FRONTEND_DIR):
    @app.get("/{full_path:path}")
    def catch_all(full_path: str):
        if full_path.startswith("api") or full_path.startswith("static") or full_path.startswith("assets"):
            raise HTTPException(status_code=404, detail="Not found")
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Not found")





