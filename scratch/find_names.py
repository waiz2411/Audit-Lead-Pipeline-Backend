import json

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    state = json.load(f)

def locate_string(obj, target, path=""):
    if isinstance(obj, str):
        if target.lower() in obj.lower():
            print(f"FOUND target '{target}' at path: {path}")
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            locate_string(item, target, f"{path}[{idx}]")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            locate_string(v, target, f"{path}.{k}")

locate_string(state, "Karachi Club GYM")
