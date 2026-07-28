import requests
import re
from bs4 import BeautifulSoup
from urllib.parse import quote

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

url = "https://www.google.com/search?q=plumbers+in+miami&tbm=lcl&hl=en"
resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.text, 'html.parser')

print("Page Title:", soup.title.string if soup.title else "")

# Find all blocks containing business titles / text
for div in soup.find_all(['div', 'span', 'a']):
    text = div.get_text(strip=True)
    if 'Plumb' in text and len(text) < 60 and not any(x in text for x in ['Search', 'Filter', 'Google', 'Maps']):
        print("REAL BIZ CANDIDATE:", text)
