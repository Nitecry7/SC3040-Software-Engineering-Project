# Architecture diagrams

This folder contains two generated architecture illustrations and one pinned Python documentation dependency. It is not part of the application or ML runtime. The two request sequences live as Mermaid diagrams in the [Supabase guide](../../SGHomie/BackEnd/supabase/README.md#valuation-request-flow) and [chatbot guide](../../SGHomie/docs/chatbot/README.md).

## Regenerate the SVGs

Requirements: Python 3.9 or newer, Graphviz (`dot` available on `PATH`), and the pinned Diagrams package in `requirements.txt`.

From the repository root in PowerShell:

```powershell
py -3 -m venv docs/architecture/.venv
docs/architecture/.venv/Scripts/python.exe -m pip install -r docs/architecture/requirements.txt
docs/architecture/.venv/Scripts/python.exe docs/architecture/generate_diagrams.py
```

On macOS or Linux, use `python3 -m venv docs/architecture/.venv`, install with `docs/architecture/.venv/bin/python -m pip install -r docs/architecture/requirements.txt`, then run `docs/architecture/.venv/bin/python docs/architecture/generate_diagrams.py`.

The generator writes SVGs to `assets/` relative to its own location. It uses labeled nodes to keep the SVGs portable and avoid provider artwork whose redistribution license or rendering behavior is uncertain. Do not install these dependencies into application or model-serving environments.

## Diagrams

- [`assets/system-overview.svg`](assets/system-overview.svg) shows browser, Supabase, server-side service, map tile, and valuation boundaries. It does not prove hosted deployment or configuration.
- [`assets/ml-lifecycle.svg`](assets/ml-lifecycle.svg) separates offline V2 research and artifact release from online bundle loading and inference. The artifact remains research/demo quality.
- The authenticated valuation sequence documents the property-ID boundary, caller-scoped RLS read, server-side feature construction, and server credential in the Supabase guide.
- Buyer and seller chatbot sequences show structured application tools separately from the language model in the chatbot guide.
