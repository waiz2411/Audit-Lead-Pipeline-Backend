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

def extract_phone_from_node(node):
    if isinstance(node, str):
        val = node.strip()
        if (val.startswith('+') or val.startswith('03') or val.startswith('021')) and len(re.sub(r'\D', '', val)) >= 7:
            return val
    elif isinstance(node, list):
        for item in node:
            p = extract_phone_from_node(item)
            if p: return p
    elif isinstance(node, dict):
        for v in node.values():
            p = extract_phone_from_node(v)
            if p: return p
    return ""

def find_phones(node):
    if isinstance(node, list):
        if len(node) > 14 and isinstance(node[11], str) and len(node[11]) > 2:
            name = node[11]
            phone = extract_phone_from_node(node)

            website = ""
            if len(node) > 7 and isinstance(node[7], list) and node[7] and isinstance(node[7][0], str) and node[7][0].startswith('http'):
                website = node[7][0]

            address = node[39] if (len(node) > 39 and isinstance(node[39], str) and len(node[39]) > 5) else (node[18] if len(node) > 18 and isinstance(node[18], str) and len(node[18]) > 5 else "")

            if not any(x in name.lower() for x in ['google', 'search', 'results']):
                print(f"NAME: {name}")
                print(f"  PHONE: {phone if phone else 'N/A'}")
                print(f"  WEBSITE: {website if website else 'N/A'}")
                print(f"  ADDRESS: {address}")
                print("-" * 50)
                
        for sub in node:
            find_phones(sub)
    elif isinstance(node, dict):
        for v in node.values():
            find_phones(v)

find_phones(data)
