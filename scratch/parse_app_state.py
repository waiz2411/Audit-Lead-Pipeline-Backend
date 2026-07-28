import json
import re

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

json_str = json.dumps(data)

# Extract place objects from json string
# Phone format: +92 3... or +1 ... or 03xx-xxxxxxx
phone_matches = re.findall(r'(\+92\s?\d{3}\s?\d{7}|\+92\s?\d{2,3}\s?\d{6,8}|03\d{2}[-\s]?\d{7}|\+1\s?\d{3}[-\s]?\d{3}[-\s]?\d{4})', json_str)
print("EXTRACTED PHONES:", set(phone_matches))

# Extract websites (http/https links to external domains)
urls = re.findall(r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*', json_str)
valid_urls = set()
for u in urls:
    if not any(d in u for d in ['google.com', 'gstatic.com', 'ggpht.com', 'googleapis.com', 'schema.org']):
        valid_urls.add(u)
print("EXTRACTED WEBSITES:", len(valid_urls), list(valid_urls)[:5])
