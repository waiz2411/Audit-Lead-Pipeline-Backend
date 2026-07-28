import json
import re
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://www.google.com/maps/search/gyms+in+karachi?hl=en', wait_until='domcontentloaded', timeout=15000)
    page.wait_for_timeout(3000)
    
    app_state = page.evaluate('() => window.APP_INITIALIZATION_STATE')
    
    # Save json string to inspect
    with open('scratch/app_state.json', 'w', encoding='utf-8') as f:
        json.dump(app_state, f, indent=2)
        
    print("Saved app_state.json successfully!")
    browser.close()
