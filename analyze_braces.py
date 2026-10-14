import sys

def analyze_braces(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    brackets = {'(': ')', '[': ']', '{': '}'}
    closing_to_opening = {v: k for k, v in brackets.items()}
    
    i = 0
    line = 1
    while i < len(content):
        char = content[i]
        
        # Handle newlines for line counting
        if char == '\n':
            line += 1
            i += 1
            continue

        # Handle multi-line comment
        if content[i:i+2] == '/*':
            i += 2
            while i < len(content) and content[i:i+2] != '*/':
                if content[i] == '\n':
                    line += 1
                i += 1
            i += 2
            continue
        
        # Handle single-line comment
        if content[i:i+2] == '//':
            while i < len(content) and content[i] != '\n':
                i += 1
            continue
        
        # Handle strings
        if char in ("'", '"', '`'):
            quote = char
            i += 1
            while i < len(content):
                if content[i] == '\\':
                    i += 2
                    continue
                if content[i] == quote:
                    break
                if content[i] == '\n':
                    line += 1
                i += 1
            i += 1
            continue

        # Handle braces
        if char in brackets:
            stack.append((char, line))
        elif char in closing_to_opening:
            opening = closing_to_opening[char]
            if not stack:
                print(f"Extra closing brace '{char}' at line {line}")
                return
            last_opening, last_line = stack.pop()
            if last_opening != opening:
                print(f"Mismatched brace: '{char}' at line {line} closes '{last_opening}' from line {last_line}")
                return
        
        i += 1

    if stack:
        print(f"Unclosed braces remaining in stack ({len(stack)}):")
        for char, line_num in stack:
            print(f"Opening '{char}' at line {line_num} was never closed.")
    else:
        print("All braces balanced.")

if __name__ == "__main__":
    analyze_braces(sys.argv[1])
