import json
import os

# Always resolve memory path relative to THIS file's location, not the cwd
MEMORY_PATH = os.path.join(os.path.dirname(__file__), "../memory/memory.json")

def read_memory() -> dict:
    """Read the memory JSON file."""
    with open(MEMORY_PATH, "r") as f:
        return json.load(f)

def write_memory(data: dict) -> None:
    """Write data to the memory JSON file."""
    with open(MEMORY_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)