import json
import re

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    app_state = json.load(f)

def extract_payload(obj):
    if isinstance(obj, str) and ")]}'" in obj:
        try:
            return json.loads(obj.split(")]}'")[1].strip())
        except Exception:
            pass
    elif isinstance(obj, list):
        for item in obj:
            res = extract_payload(item)
            if res: return res
    elif isinstance(obj, dict):
        for v in obj.values():
            res = extract_payload(v)
            if res: return res
    return None

data = extract_payload(app_state)

def find_details(node):
    if isinstance(node, list):
        if len(node) > 14 and isinstance(node[11], str) and len(node[11]) > 2:
            name = node[11]
            s_text = json.dumps(node)
            
            # Find phones: matches +92..., 03..., +1..., etc.
            phones = re.findall(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', s_text)
            clean_phones = [p for p in phones if len(re.sub(r'\D', '', p)) >= 7 and not p.startswith('2026') and not p.startswith('1008')]
            
            # Find website: matches http/https
            websites = re.findall(r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*', s_text)
            clean_web = [w for w in websites if not any(d in w for d in ['google.com', 'gstatic.com', 'ggpht.com', 'googleapis.com', 'schema.org', 'googleusercontent.com'])]
            
            # Address: string containing street/block/city
            address = node[39] if (len(node) > 39 and isinstance(node[39], str) and len(node[39]) > 5) else (node[18] if len(node) > 18 and isinstance(node[18], str) and len(node[18]) > 5 else "")

            if not any(x in name.lower() for x in ['google', 'search', 'results']):
                print(f"NAME: {name}")
                print(f"  PHONE: {clean_phones[0] if clean_phones else 'N/A'}")
                print(f"  WEBSITE: {clean_web[0] if clean_web else 'N/A'}")
                print(f"  ADDRESS: {address}")
                print("-" * 50)
                
        for sub in node:
            find_details(sub)
    elif isinstance(node, dict):
        for v in node.values():
            find_details(v)

find_details(data)
