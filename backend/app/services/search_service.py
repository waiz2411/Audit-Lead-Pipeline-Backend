import re
import logging
from typing import List, Dict, Any
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

# Exclude major non-business portals, aggregators, review directories, or blog platforms
EXCLUDED_DOMAINS = {
    'google.com', 'facebook.com', 'instagram.com', 'linkedin.com',
    'twitter.com', 'x.com', 'youtube.com', 'wikipedia.org', 'yelp.com',
    'yellowpages.com', 'amazon.com', 'reddit.com', 'pinterest.com',
    'tripadvisor.com', 'apple.com', 'bing.com', 'expertise.com',
    'angi.com', 'angieslist.com', 'thumbtack.com', 'homeadvisor.com',
    'bbb.org', 'houzz.com', 'consumeraffairs.com', 'capterra.com',
    'trustpilot.com', 'medium.com', 'quora.com', 'wordpress.com',
    'blogspot.com', 'hubspot.com', 'forbes.com', 'businessinsider.com',
    'bloomberg.com', 'wikihow.com', 'mapquest.com', 'manta.com',
    'superpages.com', 'localsearch.com', 'chamberofcommerce.com',
    'glassdoor.com', 'indeed.com', 'ziprecruiter.com'
}

# Regex pattern for listicles, directories, and blog titles
BLOG_TITLE_PATTERNS = re.compile(
    r'\b(?:top|best|\d+\s+best|\d+\s+top|list\s+of|directory|reviews?|guide|how\s+to|cost\s+of|cheap|comparison|versus|vs)\b',
    re.IGNORECASE
)

# URL path keywords associated with blog posts or aggregator lists
BLOG_URL_PATTERNS = re.compile(
    r'/(?:blog|blogs|article|articles|news|posts?|category|tag|top-\d+|best-\d+|directory|reviews)/',
    re.IGNORECASE
)

# Popular local business niches for location-only discovery
POPULAR_LOCAL_NICHES = [
    'plumbing', 'dentist', 'roofing contractor', 'electrician',
    'hvac repair', 'accounting firm', 'law firm', 'auto repair shop',
    'general contractor', 'landscaping service', 'chiropractor', 'cleaning service'
]

def _search_html_fallback(query: str, max_results: int = 15) -> List[Dict[str, Any]]:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    results = []
    
    # 1. Bing HTML Search Fallback
    try:
        bing_url = f"https://www.bing.com/search?q={requests.utils.quote(query)}"
        resp = requests.get(bing_url, headers=headers, timeout=5)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            for li in soup.select('li.b_algo'):
                h2 = li.find('h2')
                if not h2:
                    continue
                a = h2.find('a')
                if not a or not a.get('href'):
                    continue
                url = a['href']
                title = a.get_text(strip=True)
                snippet_elem = li.find('p')
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else ''
                results.append({'href': url, 'title': title, 'body': snippet})
    except Exception as e:
        logger.error(f"Bing HTML search fallback failed: {e}")

    # 2. DDG HTML Search Fallback
    if not results:
        try:
            ddg_url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
            resp = requests.get(ddg_url, headers=headers, timeout=5)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                for a in soup.select('a.result__url'):
                    href = a.get('href', '')
                    if href:
                        body_elem = a.find_parent('div', class_='result__body')
                        title = body_elem.select_one('.result__title').get_text(strip=True) if body_elem and body_elem.select_one('.result__title') else ''
                        snippet = body_elem.select_one('.result__snippet').get_text(strip=True) if body_elem and body_elem.select_one('.result__snippet') else ''
                        results.append({'href': href, 'title': title, 'body': snippet})
        except Exception as e:
            logger.error(f"DDG HTML search fallback failed: {e}")

    return results

def search_duckduckgo(keyword: str, max_results: int = 15) -> List[Dict[str, Any]]:
    """
    Search DuckDuckGo for the given keyword or location with resilient multi-provider fallbacks.
    If location-only input is detected (e.g., 'Miami', 'Texas'), expands queries across top local business niches.
    Filters out blogs, listicles, directories, and review portals.
    """
    results = []
    seen_domains = set()
    
    # Check if keyword is location-only (e.g., doesn't specify a niche)
    kw_lower = keyword.strip().lower()
    has_niche = any(n in kw_lower for n in [
        'plumb', 'dent', 'roof', 'electr', 'hvac', 'account', 'law', 'lawyer',
        'repair', 'contractor', 'builder', 'clean', 'salon', 'spa', 'clinic',
        'service', 'shop', 'store', 'agency', 'studio', 'gym', 'firm', 'hotel',
        'restaurant', 'cafe', 'auto', 'car', 'pest', 'tree', 'pool', 'solar'
    ])
    
    queries = [keyword]
    if not has_niche:
        queries = [f"{niche} in {keyword}" for niche in POPULAR_LOCAL_NICHES[:6]]

    fetch_count_per_query = max(20, (max_results * 3) // len(queries))
    
    for q in queries:
        ddg_results = []
        try:
            ddgs = DDGS()
            ddg_results = list(ddgs.text(q, max_results=fetch_count_per_query))
        except Exception as e:
            logger.warning(f"DDGS search failed for '{q}': {e}. Triggering HTML fallback...")

        if not ddg_results:
            ddg_results = _search_html_fallback(q, fetch_count_per_query)

        for item in ddg_results:
            url = item.get('href') or item.get('link') or ''
            if not url or not (url.startswith('http://') or url.startswith('https://')):
                continue
                
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]
            if ':' in domain:
                domain = domain.split(':')[0]
                
            # Filter out known aggregator/directory domains & duplicates
            if domain in EXCLUDED_DOMAINS or domain in seen_domains:
                continue
                
            title = item.get('title', '')
            snippet = item.get('body', '')
            url_path = parsed.path.lower()

            # Filter out blog posts, listicles ('Top 10...'), and guides
            if BLOG_URL_PATTERNS.search(url_path):
                continue
                
            if re.match(r'^\d+\s+(?:best|top|greatest|cheapest|popular)', title, re.IGNORECASE):
                continue

            if BLOG_TITLE_PATTERNS.search(title) and any(x in title.lower() for x in ['best', 'top 10', 'top 5', 'top 15', 'top 20', 'directory', 'near me reviews']):
                continue

            seen_domains.add(domain)
            results.append({
                'title': title,
                'domain': domain,
                'url': url,
                'snippet': snippet
            })
            
            if len(results) >= max_results:
                break
        if len(results) >= max_results:
            break

    return results
