import re
import time
import json
import logging
from typing import List, Dict, Any, Callable
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from .contact_extractor import scrape_website_contacts

logger = logging.getLogger(__name__)

# Standard mobile user agent for scraping Facebook without login wall
MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"

def scrape_meta_ads(
    ads_library_url: str,
    profile_type: str = "facebook",
    limit: int = 20,
    progress_callback: Callable[[int, str], None] = None
) -> List[Dict[str, Any]]:
    """
    Playwright-based scraper for Meta Ad Library ads.
    Extracts advertisers and scrapes their contact details from FB mobile pages or destination websites.
    """
    def report(pct: int, msg: str):
        if progress_callback:
            try:
                progress_callback(pct, msg)
            except Exception:
                pass
        logger.info(f"[{pct}%] {msg}")

    report(5, "Initializing Playwright browser...")
    results = []
    
    with sync_playwright() as p:
        # Launch browser with standard stealth parameters
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        )
        
        # Create standard context for Meta Ad Library
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        report(10, f"Navigating to Meta Ad Library URL...")
        try:
            page.goto(ads_library_url, timeout=30000)
            page.wait_for_timeout(3000)
        except Exception as e:
            report(100, f"Failed to load Ad Library: {e}")
            browser.close()
            return []

        # Accept cookie consents if they appear
        try:
            report(15, "Checking for Meta cookie consent popups...")
            cookie_buttons = page.locator("button:has-text('cookies'), button:has-text('Accept'), button[data-cookiebanner='accept_button']").all()
            for btn in cookie_buttons:
                if btn.is_visible():
                    btn.click()
                    report(18, "Accepted cookies popup.")
                    page.wait_for_timeout(1000)
                    break
        except Exception:
            pass

        # Scroll to load ad cards
        report(20, "Scrolling page to load ad cards...")
        last_height = page.evaluate("document.body.scrollHeight")
        ad_count = 0
        scroll_attempts = 0
        max_scrolls = 15
        
        while scroll_attempts < max_scrolls:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1500)
            
            current_ads = page.evaluate('document.querySelectorAll(\'a[href*="view_all_page_id="]\').length')
            report(25, f"Loaded {current_ads} ad entries so far...")
            
            if current_ads >= limit:
                ad_count = current_ads
                break
                
            new_height = page.evaluate("document.body.scrollHeight")
            if new_height == last_height:
                page.evaluate("window.scrollTo(0, document.body.scrollHeight - 500)")
                page.wait_for_timeout(500)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)
                
                if page.evaluate("document.body.scrollHeight") == last_height:
                    report(28, "No more ads loading or reached end of scroll.")
                    break
            last_height = new_height
            scroll_attempts += 1

        # Extract cards using our selector-independent JS parser
        report(35, "Parsing loaded ad cards and resolving advertisers...")
        js_parser = """
        () => {
            const cards = [];
            const links = document.querySelectorAll('a[href*="view_all_page_id="]');
            const seenIds = new Set();
            
            links.forEach(link => {
                let card = link;
                while (card && card !== document.body) {
                    if (card.tagName === 'DIV' && (card.innerText.includes('Library ID') || card.innerText.includes('ID:'))) {
                        break;
                    }
                    card = card.parentElement;
                }
                if (!card || card === document.body) {
                    card = link.parentElement?.parentElement?.parentElement?.parentElement;
                }
                
                if (card) {
                    const name = link.innerText.trim();
                    const href = link.getAttribute('href');
                    const match = href.match(/view_all_page_id=(\\d+)/);
                    const pageId = match ? match[1] : null;
                    
                    if (pageId && !seenIds.has(pageId)) {
                        seenIds.add(pageId);
                        
                        const allCardLinks = Array.from(card.querySelectorAll('a')).map(a => ({
                            text: a.innerText.trim(),
                            href: a.getAttribute('href')
                        }));
                        
                        let instagramLink = null;
                        const insta = allCardLinks.find(l => l.href && l.href.includes('instagram.com/'));
                        if (insta) {
                            instagramLink = insta.href;
                        }
                        
                        const websiteLink = allCardLinks.find(l => {
                            if (!l.href) return false;
                            const h = l.href.toLowerCase();
                            return h.startsWith('http') && 
                                   !h.includes('facebook.com') && 
                                   !h.includes('instagram.com') && 
                                   !h.includes('messenger.com') && 
                                   !h.includes('meta.com') && 
                                   !h.includes('ad_library') &&
                                   !h.includes('ads/library');
                        });
                        
                        cards.push({
                            name,
                            pageId,
                            pageUrl: `https://www.facebook.com/${pageId}`,
                            instagramLink,
                            website: websiteLink ? websiteLink.href : null
                        });
                    }
                }
            });
            return cards;
        }
        """
        raw_cards = page.evaluate(js_parser)
        browser.close()

    total_leads = len(raw_cards)
    report(40, f"Found {total_leads} unique advertiser profiles. Starting profile-level contact extraction...")
    
    if total_leads == 0:
        return []

    for idx, card in enumerate(raw_cards[:limit]):
        progress_pct = 40 + int((idx / min(total_leads, limit)) * 55)
        advertiser_name = card["name"] or "Advertiser"
        page_id = card["pageId"]
        destination_website = card["website"]
        instagram_link = card["instagramLink"]
        
        report(progress_pct, f"Scraping contact info for '{advertiser_name}' ({idx+1}/{min(total_leads, limit)})...")
        
        emails = set()
        phones = set()
        websites = set()
        if destination_website:
            websites.add(destination_website)

        if profile_type == "facebook" and page_id:
            fb_mobile_url = f"https://m.facebook.com/profile.php?id={page_id}&sk=about"
            report(progress_pct + 1, f"Loading mobile FB Page Details for {advertiser_name}...")
            
            try:
                with sync_playwright() as p:
                    mbrowser = p.chromium.launch(headless=True)
                    mcontext = mbrowser.new_context(
                        viewport={"width": 375, "height": 667},
                        user_agent=MOBILE_USER_AGENT
                    )
                    mpage = mcontext.new_page()
                    mpage.goto(fb_mobile_url, timeout=15000)
                    mpage.wait_for_timeout(2000)
                    
                    page_links = mpage.evaluate("""
                        () => Array.from(document.querySelectorAll('a')).map(a => ({
                            text: a.innerText.trim(),
                            href: a.getAttribute('href')
                        }))
                    """)
                    
                    for link in page_links:
                        href = link.get("href") or ""
                        
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
                            
                    page_text = mpage.evaluate("document.body.innerText")
                    found_emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', page_text)
                    for em in found_emails:
                        emails.add(em.lower())
                        
                    mbrowser.close()
            except Exception as e:
                logger.debug(f"FB Page Details scrape error: {e}")

        scraped_emails = []
        scraped_phones = []
        crawled_website = ""

        if websites:
            crawled_website = list(websites)[0]
            report(progress_pct + 2, f"Crawling website {crawled_website} for deeper contact enrichment...")
            try:
                parsed = urlparse(crawled_website)
                domain = parsed.netloc.lower()
                if domain.startswith("www."):
                    domain = domain[4:]
                if domain:
                    site_contacts = scrape_website_contacts(domain)
                    for email in site_contacts.get("emails", []):
                        emails.add(email.lower())
                    for phone in site_contacts.get("phones", []):
                        phones.add(phone)
            except Exception:
                pass

        if not emails and crawled_website:
            parsed = urlparse(crawled_website)
            domain = parsed.netloc.lower().replace("www.", "")
            if domain:
                emails.add(f"info@{domain}")

        social_links = {}
        if page_id:
            social_links["facebook"] = f"https://facebook.com/{page_id}"
        if instagram_link:
            social_links["instagram"] = instagram_link
        elif profile_type == "instagram" and advertiser_name:
            social_links["instagram"] = f"https://instagram.com/{advertiser_name.replace(' ', '').lower()}"

        results.append({
            "advertiser_name": advertiser_name,
            "page_id": page_id,
            "profile_url": social_links.get("instagram") if profile_type == "instagram" else social_links.get("facebook"),
            "website": crawled_website,
            "emails": sorted(list(emails)),
            "phones": sorted(list(phones)),
            "social_links": social_links
        })

    report(100, f"Finished extraction! Scraped {len(results)} advertiser profiles.")
    return results
