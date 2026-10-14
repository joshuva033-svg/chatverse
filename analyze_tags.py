import sys
import re

def analyze_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    # Use a more robust regex for JSX tags
    # This matches <TagName ..., </TagName>, or <TagName ... />
    # We handle attributes carefully.
    tag_pattern = re.compile(r'<(/?)([a-zA-Z0-9]+)(?:\s+[^>]*?)?(/?)>')
    
    for match in tag_pattern.finditer(content):
        is_closing = match.group(1) == '/'
        tag_name = match.group(2)
        is_self_closing = match.group(3) == '/'
        
        if is_self_closing:
            continue
        
        if is_closing:
            if not stack:
                print(f"Extra closing tag </{tag_name}> at position {match.start()}")
                return
            last_tag, last_pos = stack.pop()
            if last_tag != tag_name:
                print(f"Mismatched tag: </{tag_name}> at position {match.start()} closes <{last_tag}> from position {last_pos}")
                return
        else:
            stack.append((tag_name, match.start()))

    if stack:
        print(f"Unclosed tags remaining in stack ({len(stack)}):")
        for tag, pos in stack:
            print(f"Tag <{tag}> at position {pos} was never closed.")
    else:
        print("All tags balanced.")

if __name__ == "__main__":
    analyze_tags(sys.argv[1])
