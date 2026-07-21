import re
import logging
from typing import Dict, List, Set, Any
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Regular Expressions for contacts
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
INSTAGRAM_REGEX = re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/([a-zA-Z0-9_.-]+)/?', re.IGNORECASE)
FACEBOOK_REGEX = re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/([a-zA-Z0-9._-]+)/?', re.IGNORECASE)
LINKEDIN_REGEX = re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in|company)/([a-zA-Z0-9._-]+)/?', re.IGNORECASE)
WHATSAPP_REGEX = re.compile(r'(?:https?://)?(?:wa\.me|api\.whatsapp\.com/send\?phone=)(\d+)', re.IGNORECASE)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')

# Excluded generic email extensions or image strings that match email regex
EXCLUDED_EMAIL_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js')

def extract_contacts_from_html(html_content: str, base_url: str) -> Dict[str, List[str]]:
    """
    Parses HTML text and extracts emails, Instagram, Facebook, LinkedIn, WhatsApp, and phone numbers.
    """
    emails: Set[str] = set()
    instagram: Set[str] = set()
    facebook: Set[str] = set()
    linkedin: Set[str] = set()
    whatsapp: Set[str] = set()
    phones: Set[str] = set()

    if not html_content:
        return {
            'emails': [],
            'instagram': [],
            'facebook': [],
            'linkedin': [],
            'whatsapp': [],
            'phones': []
        }

    soup = BeautifulSoup(html_content, 'lxml')

    # 1. Parse all anchor tags (href links)
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        href_lower = href.lower()

        # mailto links
        if href_lower.startswith('mailto:'):
            clean_email = href[7:].split('?')[0].strip()
            if clean_email and not clean_email.endswith(EXCLUDED_EMAIL_EXTENSIONS):
                emails.add(clean_email)

        # tel links
        elif href_lower.startswith('tel:'):
            phone = href[4:].strip()
            if phone:
                phones.add(phone)

        # WhatsApp links
        elif 'wa.me/' in href_lower or 'whatsapp.com' in href_lower:
            wa_match = WHATSAPP_REGEX.search(href)
            if wa_match:
                whatsapp.add(wa_match.group(0))
            else:
                whatsapp.add(href)

        # Instagram links
        elif 'instagram.com/' in href_lower and not any(x in href_lower for x in ['/p/', '/reel/', '/stories/']):
            insta_match = INSTAGRAM_REGEX.search(href)
            if insta_match and insta_match.group(1).lower() not in ['explore', 'accounts', 'developer', 'about', 'privacy', 'legal']:
                instagram.add(f"https://instagram.com/{insta_match.group(1)}")

        # Facebook links
        elif 'facebook.com/' in href_lower:
            fb_match = FACEBOOK_REGEX.search(href)
            if fb_match and fb_match.group(1).lower() not in ['sharer', 'share', 'dialog', 'policy', 'help', 'events']:
                facebook.add(f"https://facebook.com/{fb_match.group(1)}")

        # LinkedIn links
        elif 'linkedin.com/' in href_lower:
            li_match = LINKEDIN_REGEX.search(href)
            if li_match and li_match.group(1).lower() not in ['share', 'sharing']:
                linkedin.add(f"https://linkedin.com/company/{li_match.group(1)}")

    # 2. Extract plain text regex emails
    raw_emails = EMAIL_REGEX.findall(html_content)
    for em in raw_emails:
        em_clean = em.strip().lower()
        if not em_clean.endswith(EXCLUDED_EMAIL_EXTENSIONS) and not any(x in em_clean for x in ['example.com', 'domain.com', 'schema.org']):
            emails.add(em_clean)

    # 3. Extract plain text regex phones
    raw_phones = PHONE_REGEX.findall(soup.get_text())
    for ph in raw_phones[:5]: # Cap at 5 phones
        ph_clean = ph.strip()
        if len(re.sub(r'\D', '', ph_clean)) >= 7:
            phones.add(ph_clean)

    return {
        'emails': sorted(list(emails)),
        'instagram': sorted(list(instagram)),
        'facebook': sorted(list(facebook)),
        'linkedin': sorted(list(linkedin)),
        'whatsapp': sorted(list(whatsapp)),
        'phones': sorted(list(phones))
    }

def scrape_website_contacts(domain: str) -> Dict[str, List[str]]:
    """
    Crawls website main page and contact pages to retrieve all contact info.
    """
    all_contacts: Dict[str, Set[str]] = {
        'emails': set(),
        'instagram': set(),
        'facebook': set(),
        'linkedin': set(),
        'whatsapp': set(),
        'phones': set()
    }

    base_url = f"https://{domain}"
    urls_to_crawl = [base_url, f"{base_url}/contact", f"{base_url}/about", f"{base_url}/contact-us"]
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    for url in urls_to_crawl:
        try:
            resp = requests.get(url, headers=headers, timeout=2.5, allow_redirects=True)
            if resp.status_code == 200:
                contacts = extract_contacts_from_html(resp.text, url)
                for k in all_contacts:
                    all_contacts[k].update(contacts.get(k, []))
                # If we found emails and social links on homepage, no need to crawl all subpages
                if all_contacts['emails'] and (all_contacts['instagram'] or all_contacts['facebook'] or all_contacts['linkedin']):
                    break
        except Exception as e:
            logger.debug(f"Failed to crawl {url} for contacts: {e}")
            continue

    return {k: sorted(list(v)) for k, v in all_contacts.items()}
