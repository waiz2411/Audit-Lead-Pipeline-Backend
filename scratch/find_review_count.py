import json

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    state = json.load(f)

payload_str = state[3]['qg'][2]
clean_str = payload_str.replace(")]}'\n", "").strip()
data = json.loads(clean_str)

def find_review_count(node):
    if isinstance(node, list):
        if len(node) > 14 and node[11] == "Karachi Club GYM":
            for i, val in enumerate(node):
                if val is not None and ('202' in str(val) or val == 202):
                    print(f"Review count index [{i}]: {val}")
        for item in node:
            find_review_count(item)

find_review_count(data)
