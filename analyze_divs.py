import sys
import re

def analyze_divs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    tag_pattern = re.compile(r'<(/?)(div)(?:\s+[^>]*?)?(/?)>')
    
    for match in tag_pattern.finditer(content):
        is_closing = match.group(1) == '/'
        is_self_closing = match.group(3) == '/'
        pos = match.start()
        
        if is_self_closing:
            continue
        
        if is_closing:
            if not stack:
                print(f"Extra </div> at position {pos}")
            else:
                stack.pop()
        else:
            stack.append(pos)

    print(f"Unclosed divs: {len(stack)}")
    for pos in stack:
        print(f"Unclosed <div at position {pos}")

if __name__ == "__main__":
    analyze_divs(sys.argv[1])
