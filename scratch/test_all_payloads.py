import json
import re

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    app_state = json.load(f)

def extract_all_payloads(obj):
    payloads = []
    def _walk(item):
        if isinstance(item, str) and ")]}'" in item:
            try:
                clean = item.split(")]}'")[1].strip()
                payloads.append(json.loads(clean))
            except Exception:
                pass
        elif isinstance(item, list):
            for i in item: _walk(i)
        elif isinstance(item, dict):
            for v in item.values(): _walk(v)
    _walk(obj)
    return payloads

all_data = extract_all_payloads(app_state)
print("TOTAL RPC PAYLOADS FOUND:", len(all_data))

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

seen = set()
for data in all_data:
    def _search(node):
        if isinstance(node, list):
            if len(node) > 14 and isinstance(node[11], str) and len(node[11]) > 2:
                name = node[11].strip()
                if name.lower() not in seen and not any(x in name.lower() for x in ['google', 'search', 'results']):
                    phone = extract_phone_from_node(node)
                    website = node[7][0] if (len(node) > 7 and isinstance(node[7], list) and node[7] and isinstance(node[7][0], str) and node[7][0].startswith('http')) else "N/A"
                    address = node[39] if (len(node) > 39 and isinstance(node[39], str) and len(node[39]) > 5) else (node[18] if len(node) > 18 and isinstance(node[18], str) and len(node[18]) > 5 else "N/A")
                    
                    seen.add(name.lower())
                    print(f"NAME: {name}")
                    print(f"  PHONE: {phone if phone else 'N/A'}")
                    print(f"  WEBSITE: {website}")
                    print(f"  ADDRESS: {address}")
                    print("-" * 50)
            for item in node: _search(item)
        elif isinstance(node, dict):
            for v in node.values(): _search(v)
    _search(data)
