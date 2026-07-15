import requests
from bs4 import BeautifulSoup
import urllib.parse

def run_seo_audit(url: str, html_content: str, headers: dict) -> tuple[float, dict, list]:
    issues = []
    meta_info = {}
    
    soup = BeautifulSoup(html_content, 'lxml') if html_content else BeautifulSoup('', 'lxml')
    
    title_tag = soup.find('title')
    title = title_tag.get_text().strip() if title_tag else ''
    meta_info['title'] = title
    
    desc_tag = soup.find('meta', attrs={'name': 'description'})
    desc = desc_tag.get('content', '').strip() if desc_tag else ''
    meta_info['description'] = desc
    
    if not title:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing Title Tag',
            'why_it_matters': 'The title tag is the primary element displayed in search results and is critical for SEO rankings.',
            'recommendation': 'Add a unique, descriptive <title> tag to the head element.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
    elif len(title) < 30 or len(title) > 60:
        issues.append({
            'category': 'SEO',
            'problem': f'Title Length is Suboptimal ({len(title)} characters)',
            'why_it_matters': 'Titles that are too short may not contain enough target keywords. Titles longer than 60 characters get truncated by Google.',
            'recommendation': 'Adjust the title to be between 30 and 60 characters.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })
        
    if not desc:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing Meta Description',
            'why_it_matters': 'Meta descriptions invite users to click search results. A missing description means Google will auto-generate one, often looking poor.',
            'recommendation': 'Add a descriptive <meta name="description"> tag of 120-160 characters.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
    elif len(desc) < 110 or len(desc) > 160:
        issues.append({
            'category': 'SEO',
            'problem': f'Meta Description Length Suboptimal ({len(desc)} chars)',
            'why_it_matters': 'Descriptions should be between 110 and 160 characters to avoid truncation and maximize click-through rate.',
            'recommendation': 'Adjust meta description to be between 110 and 160 characters.',
            'impact': 'Low',
            'priority': 'Medium',
            'severity': 'Low'
        })

    h1s = [h.get_text().strip() for h in soup.find_all('h1')]
    meta_info['h1_count'] = len(h1s)
    if len(h1s) == 0:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing H1 Heading',
            'why_it_matters': 'The H1 tag is the main heading on the page and tells search engines what the page is about.',
            'recommendation': 'Add exactly one H1 tag containing the page\'s main topic.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
    elif len(h1s) > 1:
        issues.append({
            'category': 'SEO',
            'problem': f'Multiple H1 Headings Found ({len(h1s)})',
            'why_it_matters': 'Multiple H1 elements can dilute theme signal for search engines.',
            'recommendation': 'Consolidate headings so there is only one H1; use H2/H3 for subheadings.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })

    h2s = soup.find_all('h2')
    if not h2s:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing H2 Headings',
            'why_it_matters': 'H2 headings structure your content logically and help users scan the page.',
            'recommendation': 'Add H2 elements to divide key sections.',
            'impact': 'Low',
            'priority': 'Low',
            'severity': 'Low'
        })

    images = soup.find_all('img')
    total_imgs = len(images)
    missing_alt = 0
    for img in images:
        if not img.get('alt'):
            missing_alt += 1
            
    meta_info['total_images'] = total_imgs
    meta_info['missing_alt_images'] = missing_alt
    if total_imgs > 0 and missing_alt > 0:
        issues.append({
            'category': 'SEO',
            'problem': f'{missing_alt} out of {total_imgs} Images Missing Alt Attribute',
            'why_it_matters': 'Search engines use alt attributes to understand image contents. They are also crucial for accessibility.',
            'recommendation': 'Add descriptive alt tags to all image tags.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })

    canonical = soup.find('link', rel='canonical')
    meta_info['canonical'] = canonical.get('href') if canonical else ''
    if not canonical:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing Canonical Link',
            'why_it_matters': 'Canonical links prevent duplicate content issues by telling search engines which version of a page is the master copy.',
            'recommendation': 'Implement a self-referential canonical tag in the page header.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })

    og_title = soup.find('meta', property='og:title')
    twitter_card = soup.find('meta', attrs={'name': 'twitter:card'})
    meta_info['og_exists'] = og_title is not None
    meta_info['twitter_card_exists'] = twitter_card is not None
    if not og_title:
        issues.append({
            'category': 'SEO',
            'problem': 'Missing Open Graph Tags',
            'why_it_matters': 'Open Graph tags control how URLs are displayed when shared on social media networks like Facebook or LinkedIn.',
            'recommendation': 'Add essential Open Graph tags (og:title, og:description, og:image, og:type).',
            'impact': 'Low',
            'priority': 'Low',
            'severity': 'Low'
        })

    seo_score = max(0.0, float(100 - len(issues) * 12))
    return seo_score, meta_info, issues
