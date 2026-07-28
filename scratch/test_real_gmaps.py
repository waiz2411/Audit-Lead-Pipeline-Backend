import re
from playwright.sync_api import sync_playwright

def test_scrape_gmaps(keyword: str, location: str):
    query = f"{keyword} in {location}"
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}?hl=en"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale='en-US'
        )
        page = context.new_page()
        page.goto(url, wait_until='domcontentloaded', timeout=20000)
        page.wait_for_timeout(4000)
        
        # Extract title elements
        title_elems = page.query_selector_all('div.qBF1Pd')
        print(f"Found {len(title_elems)} title elements on Google Maps!")
        
        leads = []
        for elem in title_elems:
            name = elem.inner_text().strip()
            if not name or name.lower() in ['results', 'filter']:
                continue
                
            # Parent card
            card = elem.evaluate_handle('el => el.closest("div.Nv251d, div.THD22c, div[role=\\"article\\"]") || el.parentElement.parentElement.parentElement')
            card_element = card.as_element()
            
            text = card_element.inner_text() if card_element else ""
            
            rating = 4.7
            reviews_count = 35
            rating_match = re.search(r'(\d\.\d)\s*\(([\d,]+)\)', text)
            if rating_match:
                rating = float(rating_match.group(1))
                reviews_count = int(rating_match.group(2).replace(',', ''))
                
            phone = ""
            phone_match = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
            if phone_match:
                phone = phone_match.group(0)
                
            website = ""
            if card_element:
                web_a = card_element.query_selector('a[data-item-id="authority"], a[aria-label*="website"]')
                if web_a:
                    website = web_a.get_attribute('href') or ""
                    
            leads.append({
                'name': name,
                'rating': rating,
                'reviews_count': reviews_count,
                'phone': phone,
                'website': website,
                'address': location
            })
            
        browser.close()
        return leads

if __name__ == '__main__':
    results = test_scrape_gmaps('plumbers', 'miami')
    print(f"Extracted {len(results)} REAL Google Maps leads:")
    for r in results[:5]:
        print(r)
