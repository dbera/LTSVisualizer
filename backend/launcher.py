import socket
import threading
import time
import webbrowser

import uvicorn

from app.main import app


HOST = "127.0.0.1"
PREFERRED_PORT = 8765


def port_is_available(host: str, port: int) -> bool:
    """Return True when the requested local port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as test_socket:
        try:
            test_socket.bind((host, port))
        except OSError:
            return False

    return True


def find_available_port(host: str, preferred_port: int) -> int:
    """Find an available port, starting with the preferred port."""
    if port_is_available(host, preferred_port):
        return preferred_port

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as test_socket:
        test_socket.bind((host, 0))
        return int(test_socket.getsockname()[1])


def open_browser_when_ready(host: str, port: int) -> None:
    """Wait for Uvicorn to accept connections, then open the dashboard."""
    address = f"http://{host}:{port}"

    for _ in range(50):
        try:
            with socket.create_connection((host, port), timeout=0.2):
                webbrowser.open(address)
                return
        except OSError:
            time.sleep(0.1)

    print("Could not open the browser automatically.")
    print(f"Open this address manually: {address}")


def main() -> None:
    port = find_available_port(HOST, PREFERRED_PORT)
    address = f"http://{HOST}:{port}"

    print("LTSVisualizer")
    print("=" * 30)
    print(f"Starting application at {address}")
    print("Close this window to stop LTSVisualizer.")
    print()

    browser_thread = threading.Thread(
        target=open_browser_when_ready,
        args=(HOST, port),
        daemon=True,
    )
    browser_thread.start()

    uvicorn.run(
        app,
        host=HOST,
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
