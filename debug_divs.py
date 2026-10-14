import sys

def debug_divs(file_path, positions):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for pos in positions:
        start = max(0, pos - 50)
        end = min(len(content), pos + 150)
        print(f"--- Position {pos} ---")
        print(content[start:end])
        print("--- End ---")

if __name__ == "__main__":
    debug_divs(sys.argv[1], [33016, 33158])
