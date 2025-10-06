#!/usr/bin/env python3
"""
Embedding Server - sentence-transformers backend

Purpose:
- Load sentence-transformers model
- Process embedding requests via JSON IPC
- Return embeddings to TypeScript

Protocol:
- Input: JSON on stdin (one request per line)
- Output: JSON on stdout (one response per line)

Request format:
{
  "id": "unique-request-id",
  "action": "embed" | "ping" | "shutdown",
  "texts": ["text1", "text2", ...],
  "model": "model-name"
}

Response format:
{
  "id": "unique-request-id",
  "success": true,
  "embeddings": [[0.1, 0.2, ...], ...],
  "error": null
}
"""

import sys
import json
import traceback
from typing import List, Dict, Any, Optional

# Import sentence-transformers
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformer = None

class EmbeddingServer:
    """Sentence-transformers embedding server"""

    def __init__(self):
        self.model: Optional[SentenceTransformer] = None
        self.current_model_name: Optional[str] = None

    def load_model(self, model_name: str) -> bool:
        """Load or switch to a different model"""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            return False

        try:
            # Reuse model if already loaded
            if self.model and self.current_model_name == model_name:
                return True

            # Load new model
            self.model = SentenceTransformer(model_name)
            self.current_model_name = model_name
            return True

        except Exception as e:
            self.log_error(f"Model loading failed: {str(e)}")
            return False

    def embed(self, texts: List[str], model_name: str = "all-MiniLM-L6-v2") -> List[List[float]]:
        """Generate embeddings for texts"""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise RuntimeError("sentence-transformers not available")

        # Load model if needed
        if not self.load_model(model_name):
            raise RuntimeError(f"Failed to load model: {model_name}")

        # Generate embeddings
        embeddings = self.model.encode(texts, convert_to_numpy=True)

        # Convert to list of lists
        return embeddings.tolist()

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a single request"""
        request_id = request.get("id", "unknown")
        action = request.get("action", "unknown")

        try:
            if action == "ping":
                return {
                    "id": request_id,
                    "success": True,
                    "pong": True,
                    "sentence_transformers_available": SENTENCE_TRANSFORMERS_AVAILABLE,
                    "error": None
                }

            elif action == "embed":
                texts = request.get("texts", [])
                model = request.get("model", "all-MiniLM-L6-v2")

                if not texts:
                    raise ValueError("No texts provided")

                embeddings = self.embed(texts, model)

                return {
                    "id": request_id,
                    "success": True,
                    "embeddings": embeddings,
                    "dimensions": len(embeddings[0]) if embeddings else 0,
                    "count": len(embeddings),
                    "error": None
                }

            elif action == "shutdown":
                return {
                    "id": request_id,
                    "success": True,
                    "shutdown": True,
                    "error": None
                }

            else:
                raise ValueError(f"Unknown action: {action}")

        except Exception as e:
            return {
                "id": request_id,
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }

    def run(self):
        """Main server loop - read from stdin, write to stdout"""
        self.log_info("Embedding server started")

        try:
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue

                try:
                    request = json.loads(line)
                    response = self.handle_request(request)

                    # Write response to stdout
                    print(json.dumps(response), flush=True)

                    # Shutdown if requested
                    if response.get("shutdown"):
                        break

                except json.JSONDecodeError as e:
                    self.log_error(f"Invalid JSON: {str(e)}")
                    error_response = {
                        "success": False,
                        "error": f"Invalid JSON: {str(e)}"
                    }
                    print(json.dumps(error_response), flush=True)

        except KeyboardInterrupt:
            self.log_info("Server interrupted")
        except Exception as e:
            self.log_error(f"Server error: {str(e)}")
        finally:
            self.log_info("Embedding server stopped")

    def log_info(self, message: str):
        """Log info message to stderr"""
        print(f"[INFO] {message}", file=sys.stderr, flush=True)

    def log_error(self, message: str):
        """Log error message to stderr"""
        print(f"[ERROR] {message}", file=sys.stderr, flush=True)

if __name__ == "__main__":
    server = EmbeddingServer()
    server.run()
