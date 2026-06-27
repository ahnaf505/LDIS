import sys
import json
import time
from rapidocr_onnxruntime import RapidOCR

engine = None


def get_engine():
    global engine
    if engine is None:
        engine = RapidOCR()
    return engine


def infer(image_path: str) -> dict:
    start = time.perf_counter()
    ocr_engine = get_engine()
    result, elapse = ocr_engine(image_path)
    elapsed = time.perf_counter() - start

    if not result:
        return {
            "ocr_text": "",
            "ocr_line_count": 0,
            "has_text": False,
            "structure": [],
            "ocr_elapsed": [round(elapsed, 2)],
        }

    lines = []
    structure = []
    for box, text, confidence in result:
        lines.append(text)
        structure.append({
            "bbox_json": json.dumps(box.tolist() if hasattr(box, "tolist") else box),
            "text": text,
            "confidence": round(float(confidence), 4) if confidence else 0.0,
        })

    return {
        "ocr_text": "\n".join(lines),
        "ocr_line_count": len(lines),
        "has_text": True,
        "structure": structure,
        "ocr_elapsed": [round(elapsed, 2)],
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python ocr_infer.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    try:
        output = infer(image_path)
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
