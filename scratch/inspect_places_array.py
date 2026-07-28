import json

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    state = json.load(f)

payload_str = state[3]['qg'][2]
clean_str = payload_str.replace(")]}'\n", "").strip()
data = json.loads(clean_str)

# Find place array for Karachi Club GYM
def inspect_place_array(node):
    if isinstance(node, list):
        if len(node) > 14 and node[11] == "Karachi Club GYM":
            print("FOUND Karachi Club GYM Array Length:", len(node))
            for i, val in enumerate(node):
                if val is not None:
                    val_str = str(val)
                    if len(val_str) < 200:
                        print(f"Index [{i}]: {val_str}")
        for item in node:
            inspect_place_array(item)

inspect_place_array(data)
