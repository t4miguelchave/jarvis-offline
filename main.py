from core.brain import ask_jarvis
from tools.fileTool import read_memory, write_memory

def chat():
    """Main interactive chat loop for Jarvis."""
    print("\n🤖 Jarvis está online. Escreve 'sair' para sair.\n")

    history = []
    memory = read_memory()

    while True:
        try:
            user_input = input("Tu: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\n👋 Jarvis desligado.")
            break

        if not user_input:
            continue

        if user_input.lower() in ("sair", "exit", "quit"):
            print("👋 Jarvis desligado.")
            break

        # Get response from Jarvis
        response = ask_jarvis(user_input, history=history)
        print(f"\n🤖 Jarvis: {response}\n")

        # Update conversation history
        history.append({"role": "user", "content": user_input})
        history.append({"role": "assistant", "content": response})

        # Keep history to last 20 messages to avoid token limits
        if len(history) > 20:
            history = history[-20:]

        # Save to memory
        memory["tasks"].append({"task": user_input, "response": response})
        write_memory(memory)


if __name__ == "__main__":
    chat()