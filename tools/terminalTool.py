import subprocess

def run_command(cmd: str) -> dict:
    """Run a shell command and return stdout, stderr, and return code."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return {
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "returncode": result.returncode
    }
