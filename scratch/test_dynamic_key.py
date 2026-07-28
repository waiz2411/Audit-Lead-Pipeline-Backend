import json

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    app_state = json.load(f)

def find_payload(obj):
    if isinstance(obj, str) and ")]}'" in obj:
        try:
            clean = obj.split(")]}'")[1].strip()
            return json.loads(clean)
        except Exception:
            pass
    elif isinstance(obj, list):
        for item in obj:
            res = find_payload(item)
            if res:
                return res
    elif isinstance(obj, dict):
        for v in obj.values():
            res = find_payload(v)
            if res:
                return res
    return None

data = find_payload(app_state)
print("SUCCESSFULLY PARSED DATA:", type(data), "len:", len(data) if data else 0)
