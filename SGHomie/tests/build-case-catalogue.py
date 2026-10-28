"""Build a source-linked case catalogue from actual Node, pytest, and pgTAP results.

Uses only the Python standard library. Source snippets are evidence references,
not inferred specifications. No tests or external services are executed here.
"""

from __future__ import annotations

import argparse
import ast
from collections import Counter, defaultdict
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote
from zoneinfo import ZoneInfo


EXPLICIT_ID = re.compile(r"^((?:FE|BE|DB)-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b")
JS_DECLARATION = re.compile(r"^(\s*)(?:(?:await|void)\s+)?(?:\w+\.)?(?:test|it)\s*\(")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def identifier(kind: str, source: str, name: str) -> str:
    explicit = EXPLICIT_ID.match(name)
    if explicit:
        return explicit.group(1)
    stem = Path(source).stem.replace(".test", "").replace("test_", "")
    slug = re.sub(r"[^A-Z0-9]+", "-", stem.upper()).strip("-")
    digest = hashlib.sha256(f"{source}\0{name}".encode()).hexdigest()[:10].upper()
    return f"{kind}-{slug}-{digest}"


def source_reference(source: str, start: int, end: int, method: str, code: str) -> dict:
    return {"file": source, "start_line": start, "end_line": end,
            "extraction": method, "source_code": code}


def js_reference(root: Path, source: str, line: int) -> dict:
    lines = (root / source).read_text().splitlines()
    if not 1 <= line <= len(lines):
        raise ValueError(f"Invalid recorded source line: {source}:{line}")
    match = JS_DECLARATION.match(lines[line - 1])
    indentation = len(match.group(1)) if match else 0
    end = len(lines)
    for index in range(line, len(lines)):
        following = JS_DECLARATION.match(lines[index])
        if following and len(following.group(1)) <= indentation:
            end = index
            break
    return source_reference(source, line, end,
                            "Recorded declaration through the next declaration at the same or outer indentation; context, not a JavaScript AST",
                            "\n".join(lines[line - 1:end]))


def python_reference(root: Path, source: str, name: str) -> tuple[dict, list[str], str | None]:
    text = (root / source).read_text()
    lines = text.splitlines()
    tree = ast.parse(text)
    function_name = name.split("[", 1)[0]
    matches = [node for node in ast.walk(tree)
               if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name]
    if len(matches) != 1:
        raise ValueError(f"Could not uniquely resolve Python case: {source}::{name}")
    function = matches[0]
    start = min([function.lineno] + [node.lineno for node in function.decorator_list])
    reference = source_reference(source, start, function.end_lineno,
                                 "Python AST function including parameterization decorators",
                                 "\n".join(lines[start - 1:function.end_lineno]))
    arguments = [arg.arg for arg in function.args.args + function.args.kwonlyargs]
    return reference, arguments, ast.get_docstring(function)


def sql_reference(root: Path, name: str) -> dict:
    case_id = EXPLICIT_ID.match(name).group(1)
    matches = []
    for path in (root / "SGHomie/BackEnd/supabase/tests").rglob("*.sql"):
        lines = path.read_text().splitlines()
        for index, line in enumerate(lines):
            if re.search(rf"['\"]{re.escape(case_id)}\s", line):
                # Keep the complete nearby SQL statement, including WITH clauses.
                start = index
                while start and not lines[start - 1].rstrip().endswith(";"):
                    start -= 1
                end = index + 1
                while end < len(lines) and not lines[end - 1].rstrip().endswith(";"):
                    end += 1
                matches.append(source_reference(path.relative_to(root).as_posix(), start + 1, end,
                                                "SQL statement containing the explicit pgTAP case ID",
                                                "\n".join(lines[start:end])))
    if len(matches) != 1:
        raise ValueError(f"Could not uniquely resolve database case {case_id}")
    return matches[0]


def junit_outcome(element: ET.Element) -> tuple[str, str | None]:
    for tag, outcome in [("error", "ERROR"), ("failure", "FAIL"), ("skipped", "SKIP")]:
        found = element.find(tag)
        if found is not None:
            details = "\n".join(value for value in [found.get("message"), found.text] if value)
            return outcome, details or None
    return "PASS", None


def classification(kind: str, source: str, name: str, reference: dict) -> dict:
    stem = Path(source).name
    if kind == "DB":
        return {"level": "Local PostgreSQL integration", "technique": "Black-box role operations and white-box RLS/trigger assertions",
                "risk": "High", "risk_basis": "Authorization, private data, and verified listing writes",
                "limitation": "Real repository migrations in an isolated local database; hosted deployment is not verified"}
    if kind == "ML":
        if stem.startswith("test_api"):
            level = "HTTP/component integration (in-process FastAPI TestClient)"
            technique = "Black-box request partitions/boundaries and white-box lifecycle/error probes"
        elif any(token in stem for token in ["bundle", "artifact_retrieval"]):
            level = "Artifact/component integration (temporary local fixtures)"
            technique = "Contract, integrity, malformed-input, and internal validation assertions"
        else:
            level = "Python unit/component"
            technique = "Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source"
        return {"level": level, "technique": technique, "risk": "High" if any(token in stem for token in ["api", "bundle", "leakage", "split", "preprocessing", "walk_forward", "uncertainty", "model", "baseline", "configuration"]) else "Medium",
                "risk_basis": "Incorrect valuation, leakage, or input/artifact contract; analytical helpers have lower direct exposure",
                "limitation": "Synthetic/local test fixtures; passing tests do not certify production model accuracy or hosted deployment"}
    static = (stem == "search-resources.test.mjs"
              or name in {"canonical seed contains both deterministic batches and removes only obsolete seed signatures",
                          "valuation migrations preserve legacy inputs and validate optional storey ranges",
                          "valuation motion is reduced when the user requests less motion"})
    if static:
        return {"level": "Static source contract", "technique": "White-box source/SQL/CSS inspection assertions",
                "risk": "Medium", "risk_basis": "Configuration, data fixture, or UI contract drift",
                "limitation": "Source text assertions do not execute database, browser, or application behavior"}
    components = {"auth-context-profile-dedupe", "auth-modal-guards", "auth-modal", "enquiry-behavior",
                  "property-details-lifecycle", "protected-route", "protected-route-contract", "search-behavior"}
    base = stem.removesuffix(".test.mjs")
    if base == "chat-markdown-security":
        level, technique = "Component/render integration", "Black-box untrusted-markdown partitions using real ReactMarkdown/ReactDOM"
    elif base in components:
        level, technique = "Component contract (VM hooks/service doubles)", "User-event/output contracts and white-box lifecycle/error branch selection"
    elif base.endswith("-endpoint") or base in {"buy-flow", "sell-flow", "chat-provider"}:
        level, technique = "Handler/flow integration (mocked external services)", "Black-box request/state partitions and white-box authorization/provider/error paths"
    elif base == "valuation" and "createValuationHandler(" in reference["source_code"]:
        level, technique = "Handler integration (actual shared valuation handler; mocked database/upstream)", "Black-box request/response contracts and white-box authentication/provenance/error paths"
    elif base == "valuation":
        level, technique = "Unit (valuation feature/lease helpers)", "Input/output boundaries, feature-order, and target-exclusion assertions"
    elif base == "valuation-range" and reference["start_line"] >= 131:
        level, technique = "Component contract (isolated JSX)", "Rendered output/accessibility assertions and invalid-input branches"
    elif base in {"property-valuation-frontend", "listing-counts", "supabase-config"}:
        level, technique = "Unit/service contract (dependency doubles)", "Black-box input/output partitions and white-box validation/failure paths"
    else:
        level, technique = "Unit", "Behavioral/boundary assertions on executable functions"
    high = any(token in base for token in ["auth", "admin", "enquiry", "valuation", "buy-flow", "sell-flow", "cleanup", "location", "markdown", "supabase-config", "protected"])
    return {"level": level, "technique": technique, "risk": "High" if high else "Medium",
            "risk_basis": "Identity, private data, trusted property evidence, privileged changes, or valuation" if high else "Search/display correctness and interface usability",
            "limitation": "Local execution with the doubles/fixtures in source; no end-to-end browser or hosted-service claim"}


def case_record(kind: str, root: Path, name: str, outcome: str, duration: float | None,
                reference: dict, error=None, **extra) -> dict:
    source = reference["file"]
    return {"id": identifier(kind, source, name), "runner": kind, "suite": source,
            "objective": name, "outcome": outcome, "duration_ms": duration, "error": error,
            "source": reference,
            "inputs_and_setup": "Executable inputs, parameter values, and setup are in the referenced declaration/decorators and suite helpers/fixtures; no generated input values are inferred.",
            "expected_result_oracle": "The assertions and expected exceptions/statuses in the referenced source are the test oracle.",
            "fixture_context_reference": source,
            **classification(kind, source, name, reference), **extra}


def load_node(root: Path, path: Path, junit: Path | None) -> tuple[list, list, dict]:
    records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    leaves = None
    if junit:
        leaves = defaultdict(list)
        for element in ET.parse(junit).getroot().iter("testcase"):
            leaves[element.get("name")].append(junit_outcome(element)[0])
    cases, containers = [], []
    for raw in records:
        source = Path(raw["file"])
        if source.is_absolute():
            source = source.relative_to(root)
        source = source.as_posix()
        name = raw["name"]
        reference = js_reference(root, source, int(raw["line"]))
        record = case_record("JS", root, name, raw["outcome"].upper(), raw.get("duration_ms"), reference, raw.get("error"))
        if leaves is not None and not leaves.get(name):
            record.update({"excluded_from_case_totals": True, "record_type": "container",
                           "reason": "Node reporter completion absent from the sibling JUnit leaf testcase list"})
            containers.append(record)
            continue
        if leaves is not None:
            junit_status = leaves[name].pop(0)
            if junit_status != record["outcome"]:
                raise ValueError(f"Node JSONL/JUnit outcome mismatch for {name}")
        cases.append(record)
    if leaves is not None and any(leaves.values()):
        raise ValueError("Node JUnit contains leaf cases missing from JSONL")
    return cases, containers, {"raw_records": len(records), "leaf_cases": len(cases), "excluded_containers": len(containers)}


def load_ml(root: Path, path: Path) -> list:
    result = []
    tree = ET.parse(path).getroot()
    for element in tree.iter("testcase"):
        name = element.get("name")
        classname = element.get("classname", "")
        parts = classname.split(".")
        source = None
        for end in range(len(parts), 0, -1):
            candidate = Path("MLPricePredictorV2", *parts[:end]).with_suffix(".py")
            if (root / candidate).is_file():
                source = candidate.as_posix()
                break
        if source is None:
            raise ValueError(f"Could not locate pytest source for {classname}::{name}")
        reference, arguments, docstring = python_reference(root, source, name)
        outcome, error = junit_outcome(element)
        result.append(case_record("ML", root, name, outcome, float(element.get("time", "0")) * 1000,
                                  reference, error, pytest_classname=classname,
                                  parameterized_case_name=name, function_arguments=arguments, docstring=docstring))
    suites = [tree] if tree.tag == "testsuite" else list(tree.findall("testsuite"))
    declared = sum(int(suite.get("tests", "0")) for suite in suites)
    if declared != len(result):
        raise ValueError(f"pytest declared count {declared} differs from extracted count {len(result)}")
    return result


def load_database(root: Path, path: Path) -> list:
    text = path.read_text()
    if re.search(r"^Bail out!", text, re.MULTILINE):
        raise ValueError("Database TAP contains a bailout; repair execution before publishing a complete catalogue")
    cases = []
    for line in text.splitlines():
        match = re.match(r"^(not ok|ok)\s+(\d+)\s+-\s+(.*?)(?:\s+#\s*(SKIP|TODO)\b(.*))?$", line, re.IGNORECASE)
        if not match:
            continue
        status, number, name, directive, reason = match.groups()
        outcome = directive.upper() if directive else ("PASS" if status.lower() == "ok" else "FAIL")
        cases.append(case_record("DB", root, name, outcome, None, sql_reference(root, name),
                                 reason.strip() if reason else None, tap_assertion_number=int(number)))
    planned = sum(map(int, re.findall(r"^1\.\.(\d+)(?:\s.*)?$", text, re.MULTILINE)))
    if not planned or planned != len(cases):
        raise ValueError(f"Database TAP plan {planned} differs from extracted count {len(cases)}")
    return cases


def escape(value) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ").replace("\t", "\\t").replace("\r", "")


def source_link(root: Path, output: Path, reference: dict) -> str:
    relative = os.path.relpath(root / reference["file"], output.parent)
    target = quote(relative, safe="/.-_") + f"#L{reference['start_line']}"
    return f"[inputs + assertions L{reference['start_line']}–{reference['end_line']}]({target})"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", type=Path, required=True, help="Node per-completion JSONL")
    parser.add_argument("--node-junit", type=Path, help="Node JUnit leaf cases; defaults to --node with .xml suffix if present")
    parser.add_argument("--ml", type=Path, required=True, help="pytest JUnit XML (parameter-expanded)")
    parser.add_argument("--database", type=Path, required=True, help="pgTAP output")
    parser.add_argument("--output", type=Path, required=True, help="Markdown catalogue")
    parser.add_argument("--json-output", type=Path, required=True, help="Machine-readable case records")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.repo_root.resolve()
    junit = args.node_junit
    if junit is None and args.node.with_suffix(".xml").is_file():
        junit = args.node.with_suffix(".xml")
    node, containers, node_counts = load_node(root, args.node, junit)
    ml = load_ml(root, args.ml)
    database = load_database(root, args.database)
    cases = node + ml + database
    ids = [case["id"] for case in cases]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate deterministic IDs; inspect source/name identity before publishing")
    counts = Counter(case["outcome"] for case in cases)
    by_suite = defaultdict(list)
    for case in cases:
        by_suite[case["suite"]].append(case)
    suites = []
    for source, suite_cases in sorted(by_suite.items()):
        path = root / source
        suites.append({"file": source, "sha256": sha256(path), "source_code": path.read_text(),
                       "case_count": len(suite_cases), "outcomes": dict(Counter(case["outcome"] for case in suite_cases)),
                       "fixture_note": "Full suite source snapshots include local helpers, imports, fixtures, parameter decorators/tables, and expected assertions. Imported helpers remain referenced by their source import paths."})
    inputs = {"node": args.node, "ml": args.ml, "database": args.database}
    if junit:
        inputs["node_junit"] = junit
    payload = {
        "schema_version": 1, "generated_at": datetime.now(ZoneInfo("Asia/Singapore")).isoformat(),
        "inputs": {key: {"file": str(path), "sha256": sha256(path)} for key, path in inputs.items()},
        "summary": {"total_leaf_cases": len(cases), "node": node_counts, "ml": len(ml), "database": len(database), "outcomes": dict(counts)},
        "interpretation": "Actual outcomes are copied from execution evidence. Technique and risk are source-based editorial classifications, not measured code coverage or release approval. Each source definition and full suite snapshot supplies executable inputs/setup and the expected-result assertions; no input/output data is invented.",
        "suites": suites, "cases": cases, "excluded_container_records": containers,
    }
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    lines = ["# SG Homie complete test-case catalogue", "",
             f"Generated {payload['generated_at']}. **{len(cases)} leaf cases**: " + ", ".join(f"{value} {key}" for key, value in sorted(counts.items())) + ".", "",
             f"Reconciliation: Node {len(node)} leaf cases from {node_counts['raw_records']} reporter records ({len(containers)} container completions excluded); pytest {len(ml)} parameter-expanded cases; pgTAP {len(database)} assertions.", "",
             "Every row preserves the executed case title and actual outcome. The source link is the executable specification: it supplies inputs, setup, and expected assertions; shared fixtures/helpers and parameter tables are in that source file. The JSON companion stores source excerpts and full suite snapshots. No test data, oracle, result, or coverage percentage is inferred from a passing title.", "",
             "Technique/risk labels describe the source approach and likely impact. VM components and mocked handlers are local contract tests; they do not establish browser behavior, live provider behavior, hosted security, production accuracy, or complete branch coverage. Static SQL/CSS/source checks are labelled separately.", "",
             "## Suite reconciliation", "", "| Source suite | Cases | Outcomes |", "|---|---:|---|"]
    for suite in suites:
        outcomes = ", ".join(f"{value} {key}" for key, value in sorted(suite["outcomes"].items()))
        lines.append(f"| {escape(suite['file'])} | {suite['case_count']} | {outcomes} |")
    for source, suite_cases in sorted(by_suite.items()):
        lines.extend(["", f"## {source}", ""])
        classifications = sorted({(case["level"], case["technique"], case["risk"]) for case in suite_cases})
        for level, technique, risk in classifications:
            lines.append(f"Level: {level}. Technique: {technique}. Risk: {risk}.")
        lines.extend(["", "Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.", "",
                      "| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |", "|---|---|---|---|"])
        for case in suite_cases:
            outcome = case["outcome"]
            if case["error"]:
                # Keep the table readable; complete diagnostics remain in JSON
                # and the original runner evidence, including assertion inputs.
                outcome += ": " + escape(case["error"].splitlines()[0][:500])
            lines.append(f"| {case['id']} | {escape(case['objective'])} | {outcome} | {source_link(root, args.output.resolve(), case['source'])} |")
    if containers:
        lines.extend(["", "## Excluded Node container completions", "",
                      "These parent completions are preserved in JSON for auditability and excluded from leaf case totals in agreement with Node JUnit.", ""])
        for case in containers:
            lines.append(f"- {escape(case['objective'])}: {case['outcome']} ({case['suite']}).")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines) + "\n")
    print(json.dumps(payload["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
