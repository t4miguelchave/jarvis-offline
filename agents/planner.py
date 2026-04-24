from core.brain import ask_jarvis

def plan_task(task: str) -> str:
    """Ask Jarvis to break a task into clear steps."""
    prompt = f"Break this task into a numbered list of clear, actionable steps:\n\n{task}"
    return ask_jarvis(prompt)