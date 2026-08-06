import re
import json
import io
import csv
import logging
import requests
from typing import List, Dict, Any, Callable
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

def parse_csv_bytes_to_items(csv_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Memory-efficient, fast CSV parser that handles large Apify / Meta Ad Library CSV dumps (up to 500k rows / 50MB+).
    Extracts and deduplicates unique advertiser pages on the fly.
    """
    text_content = ""
    try:
        text_content = csv_bytes.decode('utf-8', errors='ignore')
    except Exception:
        text_content = csv_bytes.decode('latin1', errors='ignore')

    reader = csv.DictReader(io.StringIO(text_content))
    if not reader.fieldnames:
        return []

    # Map column headers flexibly
    field_map = {}
    for col in reader.fieldnames:
        c_low = col.lower().strip()
        if c_low in ["snapshot.page_profile_uri", "page_profile_uri", "facebook_url", "fb_url", "url", "page_url", "profile_url"]:
            field_map["fb_url"] = col
        elif c_low in ["snapshot.page_name", "page_name", "name", "advertiser_name"]:
            field_map["page_name"] = col
        elif c_low in ["snapshot.link_url", "link_url", "website", "website_url"]:
            field_map["website"] = col
        elif c_low in ["snapshot.caption", "caption"]:
            field_map["caption"] = col
        elif c_low in ["snapshot.body.text", "body", "text"]:
            field_map["body"] = col

    unique_items = {}
    for row in reader:
        fb_url = row.get(field_map.get("fb_url", ""), "").strip() if field_map.get("fb_url") else ""
        if not fb_url:
            for val in row.values():
                if val and ("facebook.com/" in str(val) or "instagram.com/" in str(val)):
                    fb_url = str(val).strip()
                    break

        if not fb_url:
            continue

        key = fb_url.lower()
        if key not in unique_items:
            page_name = row.get(field_map.get("page_name", ""), "").strip() if field_map.get("page_name") else "Advertiser"
            website = row.get(field_map.get("website", ""), "").strip() if field_map.get("website") else ""
            caption = row.get(field_map.get("caption", ""), "").strip() if field_map.get("caption") else ""
            body = row.get(field_map.get("body", ""), "").strip() if field_map.get("body") else ""

            unique_items[key] = {
                "fb_url": fb_url,
                "snapshot.page_profile_uri": fb_url,
                "page_name": page_name,
                "snapshot.page_name": page_name,
                "website": website,
                "snapshot.link_url": website,
                "snapshot.caption": caption,
                "snapshot.body.text": body
            }

    return list(unique_items.values())

def extract_page_id_or_username(url_or_text: str) -> str:
    """
    Extracts numeric Page ID or Facebook username from a Facebook URL or string.
    """
    if not url_or_text:
        return ""
    
    url_str = str(url_or_text).strip()
    
    id_match = re.search(r'[?&]id=(\d+)', url_str)
    if id_match:
        return id_match.group(1)
        
    num_match = re.search(r'facebook\.com/(?:pages/[^/]+/)?(\d+)', url_str)
    if num_match:
        return num_match.group(1)
        
    user_match = re.search(r'facebook\.com/([^/?#]+)', url_str)
    if user_match:
        uname = user_match.group(1)
        if uname.lower() not in ["pages", "groups", "ads", "events", "watch", "stories", "share", "sharer"]:
            return uname

    if re.match(r'^\d+$', url_str):
        return url_str
        
    return ""

def lookup_meta_transparency_fast(page_id_or_name: str, session: requests.Session) -> Dict[str, Any]:
    """
    Performs ultra-fast Meta Ad Library transparency lookup with strict 1.2s timeout.
    """
    if not page_id_or_name:
        return {}

    search_url = f"https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id={page_id_or_name}" if re.match(r'^\d+$', page_id_or_name) else f"https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q={page_id_or_name}"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        resp = session.get(search_url, headers=headers, timeout=1.2)
        if resp.status_code == 200:
            text = resp.text
            insta_matches = re.findall(r'instagram\.com/(?:_u/)?([A-Za-z0-9_.]+)', text)
            if insta_matches:
                valid_handles = [h for h in insta_matches if h.lower() not in ["p", "reel", "stories", "tv", "explore", "about", "developer", "privacy", "legal"]]
                if valid_handles:
                    handle = valid_handles[0].rstrip('.')
                    return {
                        "instagram_handle": handle,
                        "instagram_url": f"https://www.instagram.com/{handle}"
                    }
    except Exception:
        pass

    return {}

def process_single_item_fast(item: Dict[str, Any], session: requests.Session) -> Dict[str, Any]:
    """
    Processes a single raw CSV row or Facebook URL item to extract connected Instagram ID ultra-fast.
    """
    fb_url = item.get("fb_url") or item.get("snapshot.page_profile_uri") or item.get("url") or ""
    page_name = item.get("page_name") or item.get("snapshot.page_name") or "Advertiser"
    website = item.get("website") or item.get("snapshot.link_url") or ""
    
    if any(x in website.lower() for x in ["facebook.com", "api.whatsapp.com", "fb.me"]):
        website = ""

    page_id_or_uname = extract_page_id_or_username(fb_url)
    
    instagram_handle = ""
    instagram_url = ""

    # 1. Instant local text extraction (0ms)
    combined_text = f"{fb_url} {item.get('website', '')} {item.get('snapshot.link_url', '')} {item.get('snapshot.caption', '')} {item.get('snapshot.body.text', '')}"
    direct_insta = re.findall(r'instagram\.com/(?:_u/)?([A-Za-z0-9_.]+)', combined_text)
    if direct_insta:
        valid = [h for h in direct_insta if h.lower() not in ["p", "reel", "stories", "tv", "explore", "about", "developer"]]
        if valid:
            instagram_handle = valid[0].rstrip('.')
            instagram_url = f"https://www.instagram.com/{instagram_handle}"

    # 2. Fast Meta Ad Library Transparency lookup
    if not instagram_handle and page_id_or_uname:
        trans_res = lookup_meta_transparency_fast(page_id_or_uname, session)
        if trans_res.get("instagram_handle"):
            instagram_handle = trans_res["instagram_handle"]
            instagram_url = trans_res["instagram_url"]

    emails = []
    if website:
        try:
            parsed = urlparse(website)
            domain = parsed.netloc.lower().replace("www.", "")
            if domain and "." in domain:
                emails.append(f"info@{domain}")
        except Exception:
            pass

    social_links = {}
    if fb_url:
        social_links["facebook"] = fb_url
    if instagram_url:
        social_links["instagram"] = instagram_url

    return {
        "advertiser_name": page_name,
        "page_id": page_id_or_uname,
        "facebook_url": fb_url,
        "instagram_handle": instagram_handle,
        "instagram_url": instagram_url,
        "website": website,
        "emails": emails,
        "phones": [],
        "social_links": social_links
    }

def convert_fb_items_to_instagram(
    items: List[Dict[str, Any]],
    limit: int = 10000,
    progress_callback: Callable[[int, str, dict], None] = None
) -> List[Dict[str, Any]]:
    """
    Ultra-fast, multi-threaded converter to resolve Facebook Pages & CSV rows into connected Instagram Handles.
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

    report(5, f"Initializing converter for {len(items)} items...")

    # Deduplicate items by page URI / URL
    seen_urls = set()
    unique_items = []
    for it in items:
        url = it.get("fb_url") or it.get("snapshot.page_profile_uri") or it.get("url") or ""
        url_clean = url.strip().lower()
        if url_clean and url_clean not in seen_urls:
            seen_urls.add(url_clean)
            unique_items.append(it)
        elif not url_clean and it.get("page_name"):
            unique_items.append(it)

    target_items = unique_items[:limit]
    total_to_process = len(target_items)
    report(10, f"Found {len(unique_items)} unique advertiser profiles. Processing {total_to_process} items ultra-fast...")

    if total_to_process == 0:
        return []

    results_map = {}
    completed_count = 0

    session = requests.Session()
    max_workers = 35

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_single_item_fast, item, session): idx
            for idx, item in enumerate(target_items)
        }

        for future in as_completed(futures):
            idx = futures[future]
            curr_lead = None
            try:
                res = future.result()
                results_map[idx] = res
                curr_lead = res
            except Exception as e:
                logger.error(f"Error processing item {idx}: {e}")
                results_map[idx] = {
                    "advertiser_name": target_items[idx].get("page_name") or "Advertiser",
                    "page_id": "",
                    "facebook_url": target_items[idx].get("fb_url") or "",
                    "instagram_handle": "",
                    "instagram_url": "",
                    "website": "",
                    "emails": [],
                    "phones": [],
                    "social_links": {}
                }
                curr_lead = results_map[idx]

            completed_count += 1
            progress_pct = 10 + int((completed_count / total_to_process) * 85)
            insta_str = f" -> Instagram: @{curr_lead['instagram_handle']}" if curr_lead.get('instagram_handle') else ""
            report(
                progress_pct,
                f"Resolved '{curr_lead['advertiser_name']}' ({completed_count}/{total_to_process}){insta_str}...",
                curr_lead
            )

    results = [results_map[i] for i in range(total_to_process)]
    report(100, f"Finished conversion! Converted {len(results)} advertiser profiles.")
    return results
