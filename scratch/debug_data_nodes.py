import json

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
print("Data length:", len(data))

# Find sub-lists that contain string "Karachi Club GYM"
def find_karachi_gym(node, path=""):
    if isinstance(node, list):
        for idx, item in enumerate(node):
            if isinstance(item, str) and "Karachi Club GYM" in item:
                print(f"FOUND AT {path}[{idx}]!")
                print("Parent list length:", len(node))
                print("Parent list elements sample:")
                for i, elem in enumerate(node):
                    if elem is not None and len(str(elem)) < 150:
                        print(f"  [{i}]: {elem}")
            find_karachi_gym(item, f"{path}[{idx}]")

find_karachi_gym(data)
