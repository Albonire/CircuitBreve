from fastapi import APIRouter, UploadFile, File
import ollama
import tempfile

router = APIRouter()

@router.post("/scan-circuit")
async def scan_circuit(file: UploadFile = File(...)):

    # Read uploaded image
    image_bytes = await file.read()

    # Save temporary image
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".png"
    ) as temp:

        temp.write(image_bytes)

        temp_path = temp.name

    # AI Vision Analysis
    response = ollama.chat(

        model='minicpm-v',

        messages=[
            {
                'role': 'user',

                'content': '''
You are an expert digital logic analyzer.

Your task is to analyze digital logic circuit diagrams
and reconstruct the circuit in HDL format.

IMPORTANT RULES:
- Return ONLY HDL text
- Do NOT describe the image
- Do NOT output probabilities
- Do NOT output coordinates
- Do NOT output random numbers
- Detect logic gates and wires
- Detect inputs and outputs
- Use HDL-like syntax

Supported gates:
AND
OR
NOT
XOR
XNOR
NAND
NOR

Example output:

INPUT A, B, Cin

X1 = XOR(A, B)
SUM = XOR(X1, Cin)

C1 = AND(A, B)
C2 = AND(X1, Cin)

COUT = OR(C1, C2)

OUTPUT SUM, COUT

ONLY OUTPUT HDL.
''',

                'images': [temp_path]
            }
        ]
    )

    # Extract response text
    result = response['message']['content']

    return {
        "hdl": result
    }