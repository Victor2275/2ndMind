import os

WORKSPACE_ROOT = r"c:\Users\gusev\Documents\2ndMind"
CONTEXT_ROOT = os.path.join(WORKSPACE_ROOT, "context")
EXCLUDE_DIRS = ["99_archive", "assets"]
EXCLUDE_FILES = []

EXPLICIT_FILES = [
    "AGENTS.md",
    "web/context.md",
    "web/DECISIONS.md"
]

OUT_FILE = os.path.join(WORKSPACE_ROOT, "Mastermind.md")

with open(OUT_FILE, "w", encoding="utf-8") as out:
    out.write("# 2ndMind Mastermind Context\n\n")
    out.write("This document contains the complete current context for Victor Gusev. Treat this as the absolute source of truth.\n\n")
    
    # Add explicit files
    for ef in EXPLICIT_FILES:
        path = os.path.join(WORKSPACE_ROOT, ef)
        if os.path.exists(path):
            out.write(f"## File: {ef}\n\n")
            out.write("```markdown\n")
            with open(path, "r", encoding="utf-8") as inf:
                out.write(inf.read())
            out.write("\n```\n\n")
            
    # Add context files
    for root, dirs, files in os.walk(CONTEXT_ROOT):
        # modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file.endswith(".md") and file not in EXCLUDE_FILES:
                path = os.path.join(root, file)
                rel_path = os.path.relpath(path, WORKSPACE_ROOT)
                
                out.write(f"## File: {rel_path.replace(chr(92), '/')}\n\n")
                out.write("```markdown\n")
                try:
                    with open(path, "r", encoding="utf-8") as inf:
                        out.write(inf.read())
                except Exception as e:
                    out.write(f"Error reading file: {e}\n")
                out.write("\n```\n\n")

print(f"Successfully generated {OUT_FILE}")
