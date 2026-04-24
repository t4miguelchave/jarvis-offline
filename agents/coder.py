from core.brain import ask_jarvis

def generate_code(task: str) -> str:
    """Ask Jarvis to write code for a given task."""
    prompt = f"Write clean, working code for the following task. Include a brief explanation:\n\n{task}"
    return ask_jarvis(prompt)