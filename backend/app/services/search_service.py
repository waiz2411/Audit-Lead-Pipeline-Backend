import re
import logging
from typing import List, Dict, Any
from urllib.parse import urlparse
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

def search_duckduckgo(keyword: str, max_results: int = 15) -> List[Dict[str, Any]]:
    """
    Search DuckDuckGo for the given keyword or location.
    If location-only input is detected (e.g., 'Miami', 'Texas'), expands queries across top local business niches.
    Filters out blogs, listicles (e.g. 'Top 10 Plumbers'), directories, and review portals.
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
        # Generate queries for location across top local business niches
        queries = [f"{niche} in {keyword}" for niche in POPULAR_LOCAL_NICHES[:6]]

    fetch_count_per_query = max(20, (max_results * 3) // len(queries))
    
    try:
        ddgs = DDGS()
        for q in queries:
            ddg_results = ddgs.text(q, max_results=fetch_count_per_query)
            
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
                    
                # 1. Filter out known aggregator/directory domains & duplicates
                if domain in EXCLUDED_DOMAINS or domain in seen_domains:
                    continue
                    
                title = item.get('title', '')
                snippet = item.get('body', '')
                url_path = parsed.path.lower()

                # 2. Filter out blog posts, listicles ('Top 10...'), and guides
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
                
    except Exception as e:
        logger.error(f"Error performing DuckDuckGo search for '{keyword}': {e}")
        
    return results

