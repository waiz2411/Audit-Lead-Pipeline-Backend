import re
import time
import json
import os
import logging
from typing import List, Dict, Any, Callable
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from playwright.sync_api import sync_playwright
from .contact_extractor import scrape_website_contacts

logger = logging.getLogger(__name__)

# Mobile User-Agent for Facebook mobile page contact extraction
MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"

def find_ads_in_json(obj: Any, ads_list: list, seen_ids: set):
    """
    Recursively scans the raw JSON response payload from Facebook GraphQL for ad objects.
    """
    if isinstance(obj, dict):
        if "ad_archive_id" in obj and "page_id" in obj:
            ad_id = str(obj["ad_archive_id"])
            if ad_id and ad_id not in seen_ids:
                seen_ids.add(ad_id)
                page_id = str(obj.get("page_id") or "")
                page_name = obj.get("page_name") or obj.get("byline") or ""
                profile_uri = obj.get("page_profile_uri") or ""
                
                # Extract website links from snapshot fields
                website = obj.get("link_url") or ""
                if not website and obj.get("cards"):
                    for card in obj["cards"]:
                        if card.get("link_url"):
                            website = card["link_url"]
                            break
                
                # Extract Instagram links
                instagram_link = None
                if profile_uri and "instagram.com" in profile_uri:
                    instagram_link = profile_uri
                elif obj.get("cards"):
                    for card in obj["cards"]:
                        if card.get("link_url") and "instagram.com" in card["link_url"]:
                            instagram_link = card["link_url"]
                            break
                            
                ads_list.append({
                    "name": page_name,
                    "pageId": page_id,
                    "pageUrl": f"https://www.facebook.com/{page_id}" if page_id else (profile_uri or ""),
                    "instagramLink": instagram_link,
                    "website": website,
                    "profileUri": profile_uri
                })
        else:
            for v in obj.values():
                find_ads_in_json(v, ads_list, seen_ids)
    elif isinstance(obj, list):
        for item in obj:
            find_ads_in_json(item, ads_list, seen_ids)

def scrape_meta_ads(
    ads_library_url: str,
    profile_type: str = "facebook",
    limit: int = 20,
    progress_callback: Callable[[int, str], None] = None
) -> List[Dict[str, Any]]:
    """
    Highly performant, language-agnostic scraper for Meta Ad Library ads.
    Uses network interception to grab GraphQL JSON responses and crawls advertiser profiles.
    """
    def report(pct: int, msg: str, lead_data: dict = None):
        if progress_callback:
            try:
                progress_callback(pct, msg, lead_data)
            except Exception:
                try:
                    progress_callback(pct, msg)
                except Exception:
                    pass
        logger.info(f"[{pct}%] {msg}")

    report(5, "Initializing Playwright browser...")
    ads_list = []
    seen_ids = set()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        )
        
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # Listen to GraphQL responses to intercept ad payloads
        def handle_response(response):
            if "api/graphql" in response.url:
                try:
                    text = response.text()
                    for line in text.split("\n"):
                        if line.strip():
                            data = json.loads(line.strip())
                            find_ads_in_json(data, ads_list, seen_ids)
                except Exception:
                    pass

        page.on("response", handle_response)
        
        report(10, "Navigating to Meta Ad Library URL...")
        try:
            page.goto(ads_library_url, timeout=35000)
            page.wait_for_timeout(6000) # Give it time to load initial page and run scripts
        except Exception as e:
            report(100, f"Failed to load Ad Library: {e}")
            browser.close()
            return []

        # Parse initial ads embedded in page source HTML script tags
        report(15, "Parsing initial ads from page script cache...")
        try:
            scripts = page.evaluate("""
                () => Array.from(document.querySelectorAll('script[type="application/json"]')).map(s => s.innerText)
            """)
            for script_content in scripts:
                if "ad_library_main" in script_content or "search_results_connection" in script_content:
                    try:
                        data = json.loads(script_content)
                        find_ads_in_json(data, ads_list, seen_ids)
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f"Error parsing script cache: {e}")

        # Accept cookie consents if blocking
        try:
            cookie_buttons = page.locator("button:has-text('cookies'), button:has-text('Accept'), button[data-cookiebanner='accept_button']").all()
            for btn in cookie_buttons:
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(1000)
                    break
        except Exception:
            pass

        # Scrolling routine to load ads via GraphQL network interception
        report(20, f"Scrolling to load ads (Target: {limit})...")
        scroll_attempts = 0
        max_scrolls = 150 # allow deeper scrolling for larger limits
        
        # Adjust max scrolls for large limit requests
        if limit > 200:
            max_scrolls = int(limit / 12)
            
        last_count = len(ads_list)
        consecutive_no_change = 0

        while len(ads_list) < limit and scroll_attempts < max_scrolls:
            # Scroll down in small steps to reliably trigger lazy-load listeners
            for _ in range(4):
                page.evaluate("""
                    () => {
                        window.scrollBy(0, 1000);
                        document.querySelectorAll('div').forEach(el => {
                            const style = window.getComputedStyle(el);
                            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                                el.scrollBy(0, 1000);
                            }
                        });
                    }
                """)
                page.wait_for_timeout(200)
                
            # Automatically detect and dismiss login prompts or popups that block scroll inputs
            try:
                # Target close buttons of any tag inside dialogs (including <a>, <i>, <button>, etc.)
                close_selectors = [
                    "div[role='dialog'] a[aria-label*='Close']",
                    "div[role='dialog'] [aria-label*='Close']",
                    "div[role='dialog'] [aria-label*='close']",
                    "div[role='dialog'] button[aria-label*='Close']",
                    "div[role='dialog'] button:has-text('Close')",
                    "[aria-label*='Close']",
                    "[aria-label*='close']",
                    "[aria-label*='Dismiss']",
                    "[aria-label*='dismiss']",
                    "[aria-label*='خارج']",
                    "[aria-label*='بند']"
                ]
                for selector in close_selectors:
                    elements = page.locator(selector).all()
                    for el in elements:
                        if el.is_visible():
                            el.click()
                            page.wait_for_timeout(300)
                            break
            except Exception:
                pass

            # Yield time for data to stream in
            page.wait_for_timeout(800)
            
            current_count = len(ads_list)
            report(25, f"Scraped {current_count} ads from background stream...")
            
            # Check if page URL has login/cookie wall redirection
            current_url = page.url
            if "login" in current_url.lower() or "checkpoint" in current_url.lower() or "captcha" in current_url.lower():
                report(27, f"[WARNING] Meta redirected to login or security check page: {current_url}")
            
            if current_count >= limit:
                break
                
            if current_count == last_count:
                consecutive_no_change += 1
                # Wait longer on subsequent empty attempts to give network time to load next query batch
                if consecutive_no_change >= 4:
                    page.wait_for_timeout(1500)
                    try:
                        os.makedirs("static", exist_ok=True)
                        page.screenshot(path="static/meta_ad_scroll_error.png")
                        logger.warning(f"Scrolling stuck at {current_count}. Saved diagnostics. URL: {current_url}")
                    except Exception:
                        pass
                if consecutive_no_change >= 12: # Break if no change after 12 attempts
                    break
            else:
                consecutive_no_change = 0
                
            last_count = current_count
            scroll_attempts += 1

        browser.close()

    total_leads = len(ads_list)
    report(40, f"Found {total_leads} unique advertiser profiles in stream. Starting parallel contact details extraction...")
    
    if total_leads == 0:
        return []

    # Process and enrich contacts in parallel (up to target limit)
    results_map = {}
    completed_count = 0
    total_to_enrich = min(total_leads, limit)

    def enrich_single_lead(idx, card):
        advertiser_name = card["name"] or "Advertiser"
        page_id = card["pageId"]
        destination_website = card["website"]
        instagram_link = card["instagramLink"]
        profile_uri = card.get("profileUri") or ""
        
        emails = set()
        phones = set()
        websites = set()
        if destination_website:
            websites.add(destination_website)

        # 1. Scrape Facebook page mobile Details for emails/phones if FB Page ID exists
        if page_id and re.match(r'^\d+$', page_id):
            fb_mobile_url = f"https://m.facebook.com/profile.php?id={page_id}&sk=about"
            try:
                headers = {
                    "User-Agent": MOBILE_USER_AGENT,
                    "Accept-Language": "en-US,en;q=0.9"
                }
                import requests
                from bs4 import BeautifulSoup
                
                resp = requests.get(fb_mobile_url, headers=headers, timeout=(1.5, 3.0))
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    for a in soup.find_all('a', href=True):
                        href = a['href']
                        if "mailto:" in href.lower():
                            email = href.replace("mailto:", "").split("?")[0].strip()
                            if email and "@" in email:
                                emails.add(email.lower())
                        elif "tel:" in href.lower():
                            phone = href.replace("tel:", "").strip()
                            if phone:
                                phones.add(phone)
                        elif href.startswith("http") and not any(x in href.lower() for x in ["facebook.com", "instagram.com", "google.com", "apple.com"]):
                            websites.add(href)
                            
                    page_text = soup.get_text()
                    found_emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', page_text)
                    for em in found_emails:
                        emails.add(em.lower())
            except Exception:
                pass

        # 2. Crawl discovered websites to find deeper email/phone info
        crawled_website = ""
        if websites:
            crawled_website = list(websites)[0]
            try:
                parsed = urlparse(crawled_website)
                domain = parsed.netloc.lower().replace("www.", "")
                if domain:
                    site_contacts = scrape_website_contacts(domain)
                    for email in site_contacts.get("emails", []):
                        emails.add(email.lower())
                    for phone in site_contacts.get("phones", []):
                        phones.add(phone)
            except Exception:
                pass

        # Fallback default info email if none found
        if not emails and crawled_website:
            parsed = urlparse(crawled_website)
            domain = parsed.netloc.lower().replace("www.", "")
            if domain:
                emails.add(f"info@{domain}")

        # Format social profile links (strictly verified, no fake fallbacks)
        social_links = {}
        
        # Only add Facebook link if advertiser is known to have a Facebook Page
        if page_id and (profile_type == "facebook" or (profile_uri and "facebook.com" in profile_uri)):
            social_links["facebook"] = f"https://facebook.com/{page_id}"
            
        # Only add Instagram link if a valid instagram URL is parsed
        if instagram_link:
            social_links["instagram"] = instagram_link
        elif profile_uri and "instagram.com" in profile_uri:
            social_links["instagram"] = profile_uri

        return {
            "advertiser_name": advertiser_name,
            "page_id": page_id,
            "profile_url": social_links.get("instagram") if profile_type == "instagram" else social_links.get("facebook"),
            "website": crawled_website,
            "emails": sorted(list(emails)),
            "phones": sorted(list(phones)),
            "social_links": social_links
        }

    # Run up to 15 workers in parallel to maximize speed
    max_workers = 15
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(enrich_single_lead, idx, card): idx 
            for idx, card in enumerate(ads_list[:limit])
        }
        
        for future in as_completed(futures):
            idx = futures[future]
            curr_lead = None
            try:
                lead_data = future.result()
                results_map[idx] = lead_data
                curr_lead = lead_data
            except Exception as e:
                logger.error(f"Error enriching lead {idx}: {e}")
                results_map[idx] = {
                    "advertiser_name": ads_list[idx]["name"] or "Advertiser",
                    "page_id": ads_list[idx]["pageId"],
                    "profile_url": ads_list[idx]["pageUrl"],
                    "website": ads_list[idx]["website"],
                    "emails": [],
                    "phones": [],
                    "social_links": {}
                }
                curr_lead = results_map[idx]
            
            completed_count += 1
            progress_pct = 40 + int((completed_count / total_to_enrich) * 55)
            report(
                progress_pct, 
                f"Enriched contacts for '{curr_lead['advertiser_name']}' ({completed_count}/{total_to_enrich})...",
                curr_lead
            )

    # Reassemble results in order
    results = [results_map[i] for i in range(total_to_enrich)]
    
    report(100, f"Finished extraction! Scraped {len(results)} advertiser profiles.")
    return results
