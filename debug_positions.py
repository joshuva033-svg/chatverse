import sys

def debug_positions(file_path, positions):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for pos in positions:
        start = max(0, pos - 100)
        end = min(len(content), pos + 100)
        print(f"--- Position {pos} ---")
        print(content[start:end])
        print("--- End ---")

if __name__ == "__main__":
    debug_positions(sys.argv[1], [7168, 7676])
