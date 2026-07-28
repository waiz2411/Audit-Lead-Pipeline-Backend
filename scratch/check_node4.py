import json

with open('scratch/app_state.json', 'r', encoding='utf-8') as f:
    state = json.load(f)

payload_str = state[3]['qg'][2]
clean_str = payload_str.replace(")]}'\n", "").strip()
data = json.loads(clean_str)

def check_node4(node):
    if isinstance(node, list):
        if len(node) > 14 and isinstance(node[11], str) and len(node[11]) > 2:
            print(f"\nNAME: {node[11]}")
            if len(node) > 4 and isinstance(node[4], list):
                print("node[4]:", node[4])
        for sub in node:
            check_node4(sub)
    elif isinstance(node, dict):
        for v in node.values():
            check_node4(v)

check_node4(data)
