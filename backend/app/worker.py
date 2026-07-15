import asyncio
import os
import time
import traceback
from playwright.sync_api import sync_playwright

from .database import SessionLocal
from .models import Job, AuditResult, Settings
from .auditor.seo import run_seo_audit
from .auditor.performance import run_performance_audit
from .auditor.accessibility import run_accessibility_audit
from .auditor.security import run_security_audit
from .auditor.design import run_design_audit

# Directory to save screenshots
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def close_browser():
    pass

def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise

def run_desktop_tablet_sync(url, screenshot_path_desktop, screenshot_path_tablet, timeout_seconds):
    page_metrics = {
        'fcp': 1200,
        'lcp': 2400,
        'cls': 0.08,
        'tbt': 150,
        'dom_size': 600,
        'unused_js': False,
        'unused_css': False,
        'render_blocking': 1
    }
    responsive_issues = []
    html_content = ""
    response_headers = {}
    final_url = url
    is_https = url.startswith('https://')
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, yugo like Gecko) Chrome/124.0.0.0 Safari/537.36',
            ignore_https_errors=True
        )
        page = context.new_page()
        try:
            start_time = time.time()
            response = None
            try:
                response = page.goto(url, timeout=timeout_seconds * 1000, wait_until='domcontentloaded')
            except Exception as e:
                print(f"Navigation warning for {url}: {e}")

            load_time = int((time.time() - start_time) * 1000)
            page_metrics['lcp'] = load_time
            page_metrics['fcp'] = int(load_time * 0.6)

            final_url = page.url
            is_https = final_url.startswith('https://')

            try:
                html_content = page.content()
            except Exception:
                pass

            if response:
                response_headers = dict(response.headers)

            # Take desktop screenshot
            try:
                page.screenshot(path=screenshot_path_desktop, type='jpeg', quality=80)
            except Exception:
                pass

            # Evaluate DOM Size
            try:
                dom_size = page.evaluate("() => document.getElementsByTagName('*').length")
                page_metrics['dom_size'] = dom_size
            except Exception:
                pass

            # Check horizontal scroll
            try:
                has_horizontal_scroll = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
                if has_horizontal_scroll:
                    responsive_issues.append({
                        'category': 'Responsive',
                        'problem': 'Horizontal scrollbar present on desktop layout',
                        'why_it_matters': 'Horizontal scrolling on websites causes poor UX and violates responsive design guidelines.',
                        'recommendation': 'Avoid fixed-width containers; use max-width: 100% or flexbox layouts.',
                        'impact': 'Medium',
                        'priority': 'Medium',
                        'severity': 'Medium'
                    })
            except Exception:
                pass

            # Tablet Audit (Resize viewport)
            try:
                page.set_viewport_size({'width': 768, 'height': 1024})
                time.sleep(0.4)  # layout reflow
                page.screenshot(path=screenshot_path_tablet, type='jpeg', quality=80)
            except Exception:
                pass

        except Exception as e:
            print(f"Error in desktop/tablet sync audit for {url}: {e}")
        finally:
            context.close()
            browser.close()
            
    return page_metrics, responsive_issues, html_content, response_headers, final_url, is_https

def run_mobile_sync(url, screenshot_path_mobile, timeout_seconds):
    responsive_issues = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context_mobile = browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            ignore_https_errors=True
        )
        page_mobile = context_mobile.new_page()
        try:
            try:
                page_mobile.goto(url, timeout=timeout_seconds * 1000, wait_until='domcontentloaded')
            except Exception as e:
                print(f"Mobile navigation warning for {url}: {e}")
            try:
                page_mobile.screenshot(path=screenshot_path_mobile, type='jpeg', quality=80)
            except Exception:
                pass

            # Check legibility
            try:
                tiny_text_elements = page_mobile.evaluate("""() => {
                    const elms = Array.from(document.querySelectorAll('p, span, div, a'));
                    let count = 0;
                    for (let el of elms) {
                        const style = window.getComputedStyle(el);
                        const size = parseFloat(style.fontSize);
                        if (size && size < 12 && el.innerText && el.innerText.trim().length > 10) {
                            count++;
                        }
                    }
                    return count;
                }""")
                if tiny_text_elements > 3:
                    responsive_issues.append({
                        'category': 'Responsive',
                        'problem': 'Legibility issues: tiny font sizes on mobile viewport',
                        'why_it_matters': 'Font sizes below 12px are hard to read on mobile screens and strain readers.',
                        'recommendation': 'Ensure body text has a font-size of at least 14px or 16px in stylesheets.',
                        'impact': 'Medium',
                        'priority': 'Medium',
                        'severity': 'Medium'
                    })
            except Exception:
                pass
        except Exception as e:
            print(f"Error in mobile sync audit for {url}: {e}")
        finally:
            context_mobile.close()
            browser.close()
            
    return responsive_issues

async def audit_domain(domain: str, result_id: int):
    db = get_db()
    try:
        settings = db.query(Settings).first()
        if not settings:
            settings = Settings()
            db.add(settings)
            db.commit()
            db.refresh(settings)

        # Retrieve audit record
        db_result = db.query(AuditResult).filter(AuditResult.id == result_id).first()
        if not db_result:
            return

        # Normalize URL
        url = domain.strip().lower()
        if not url.startswith('http://') and not url.startswith('https://'):
            url = 'https://' + url

        screenshot_path_desktop = os.path.join(SCREENSHOT_DIR, f"{result_id}_desktop.jpg")
        screenshot_path_tablet = os.path.join(SCREENSHOT_DIR, f"{result_id}_tablet.jpg")
        screenshot_path_mobile = os.path.join(SCREENSHOT_DIR, f"{result_id}_mobile.jpg")

        # Run Playwright Audits concurrently in separate threads using Sync API
        desktop_task = asyncio.to_thread(
            run_desktop_tablet_sync,
            url,
            screenshot_path_desktop,
            screenshot_path_tablet,
            settings.timeout
        )
        mobile_task = asyncio.to_thread(
            run_mobile_sync,
            url,
            screenshot_path_mobile,
            settings.timeout
        )
        
        (page_metrics, desktop_responsive_issues, html_content, response_headers, final_url, is_https), mobile_responsive_issues = await asyncio.gather(
            desktop_task,
            mobile_task
        )
        
        responsive_issues = desktop_responsive_issues + mobile_responsive_issues

        # Update screenshot paths in db
        db_result.screenshot_path_desktop = f"/static/screenshots/{result_id}_desktop.jpg"
        db_result.screenshot_path_tablet = f"/static/screenshots/{result_id}_tablet.jpg"
        db_result.screenshot_path_mobile = f"/static/screenshots/{result_id}_mobile.jpg"

        # Auditing Heuristics
        score_seo, meta_info, seo_issues = run_seo_audit(final_url, html_content, {})
        score_perf, perf_issues = run_performance_audit(page_metrics)
        score_a11y, a11y_issues = run_accessibility_audit(html_content)
        score_sec, sec_issues = run_security_audit(response_headers, is_https)
        score_design, design_issues = run_design_audit(html_content, responsive_issues)

        # Responsive score calculation
        score_resp = max(0.0, float(100 - len(responsive_issues) * 20))

        # Overall Score
        # SEO 25% | Performance 25% | Accessibility 15% | Security 15% | Responsive 10% | Design 10%
        score_overall = (score_seo * 0.25) + (score_perf * 0.25) + (score_a11y * 0.15) + (score_sec * 0.15) + (score_resp * 0.10) + (score_design * 0.10)

        # Merge issues
        all_issues = seo_issues + perf_issues + a11y_issues + sec_issues + design_issues

        # Update DB fields
        db_result.score_seo = round(score_seo, 1)
        db_result.score_performance = round(score_perf, 1)
        db_result.score_accessibility = round(score_a11y, 1)
        db_result.score_security = round(score_sec, 1)
        db_result.score_responsive = round(score_resp, 1)
        db_result.score_design = round(score_design, 1)
        db_result.score_overall = round(score_overall, 1)
        db_result.meta_info = meta_info
        db_result.issues = all_issues
        db_result.status = 'Finished'
        db.commit()

    except Exception as e:
        db.rollback()
        db_result = db.query(AuditResult).filter(AuditResult.id == result_id).first()
        if db_result:
            db_result.status = 'Failed'
            db_result.error_log = traceback.format_exc()
            db.commit()
    finally:
        db.close()

active_workers = []

async def update_job_counters(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            total = db.query(AuditResult).filter(AuditResult.job_id == job_id).count()
            finished = db.query(AuditResult).filter(AuditResult.job_id == job_id, AuditResult.status == 'Finished').count()
            failed = db.query(AuditResult).filter(AuditResult.job_id == job_id, AuditResult.status == 'Failed').count()

            job.completed_websites = finished
            job.failed_websites = failed
            job.running_websites = total - finished - failed

            if finished + failed == total:
                job.status = 'finished'
            db.commit()
    except Exception as e:
        print(f"Error updating job counters for job {job_id}: {e}")
    finally:
        db.close()

async def audit_worker(worker_id: int):
    print(f"Starting audit worker {worker_id}")
    while True:
        db = SessionLocal()
        res = None
        job_to_update = None
        try:
            settings = db.query(Settings).first()
            target_concurrency = settings.concurrency if settings else 3
            if worker_id >= target_concurrency:
                break

            # Find the first queued audit result whose job is running
            res = db.query(AuditResult).join(Job).filter(
                Job.status == 'running',
                AuditResult.status == 'Queued'
            ).order_by(AuditResult.id.asc()).first()

            if res:
                # Mark it as Fetching immediately to reserve it
                res.status = 'Fetching'
                db.commit()

                result_id = res.id
                domain = res.domain
                job_id = res.job_id
                job_to_update = job_id
            else:
                result_id = None
        except Exception as e:
            print(f"Worker {worker_id} database query error: {e}")
            result_id = None
        finally:
            db.close()

        if result_id:
            try:
                # Run the audit
                await audit_domain(domain, result_id)
            except Exception as e:
                print(f"Worker {worker_id} error auditing {domain}: {e}")
            finally:
                if job_to_update:
                    await update_job_counters(job_to_update)
        else:
            # No jobs queued, sleep for a bit
            await asyncio.sleep(1)

    print(f"Exiting audit worker {worker_id}")

async def worker_manager_loop():
    global active_workers
    print("Starting worker manager loop...")
    while True:
        await asyncio.sleep(2)
        db = SessionLocal()
        try:
            settings = db.query(Settings).first()
            if not settings:
                settings = Settings()
                db.add(settings)
                db.commit()
                db.refresh(settings)

            target_concurrency = settings.concurrency

            # Clean up finished/failed worker tasks from the active list
            active_workers = [w for w in active_workers if not w.done()]

            # Spawning workers if needed
            while len(active_workers) < target_concurrency:
                worker_id = len(active_workers)
                worker_task = asyncio.create_task(audit_worker(worker_id))
                active_workers.append(worker_task)

        except Exception as e:
            print("Worker manager error:", e)
        finally:
            db.close()
