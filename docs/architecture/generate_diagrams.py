"""Generate the branded SG Homie architecture SVGs for documentation."""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge, Node


ASSETS = Path(__file__).resolve().parent / "assets"
BLUE = "#2563EB"
DEEP_BLUE = "#1D4ED8"
SOFT_BLUE = "#EFF6FF"
BLUE_BORDER = "#BFDBFE"
INK = "#1F2937"
MUTED = "#64748B"
NEUTRAL = "#F8FAFC"
NEUTRAL_BORDER = "#CBD5E1"
GREEN = "#059669"
GREEN_SOFT = "#ECFDF5"
AMBER = "#B45309"
AMBER_SOFT = "#FFFBEB"


def box(label: str, fill: str = "#FFFFFF", border: str = NEUTRAL_BORDER) -> Node:
    return Node(
        label,
        shape="box",
        style="rounded,filled",
        fillcolor=fill,
        color=border,
        fontname="Arial",
        fontsize="11",
        fontcolor=INK,
        margin="0.18,0.12",
        width="2.35",
        height="0.82",
        fixedsize="false",
    )


def render(filename: str, title: str, direction: str = "LR") -> Diagram:
    ASSETS.mkdir(parents=True, exist_ok=True)
    return Diagram(
        title,
        filename=str(ASSETS / filename),
        outformat="svg",
        show=False,
        direction=direction,
        graph_attr={
            "bgcolor": "#FFFFFF",
            "pad": "0.25",
            "nodesep": "0.38",
            "ranksep": "0.55",
            "splines": "ortho",
            "fontname": "Arial",
            "fontsize": "18",
            "fontcolor": DEEP_BLUE,
        },
        node_attr={"fontname": "Arial", "fontsize": "10", "fontcolor": INK},
        edge_attr={"color": BLUE, "fontcolor": DEEP_BLUE, "fontsize": "9", "fontname": "Arial"},
    )


def system_overview() -> None:
    with render("system-overview", "SG Homie system overview"):
        browser = box("React + TypeScript\nBrowser app\nUser session", SOFT_BLUE, BLUE_BORDER)

        with Cluster(
            "Supabase trust boundary",
            graph_attr={"style": "rounded,filled", "color": BLUE_BORDER, "bgcolor": SOFT_BLUE, "fontcolor": DEEP_BLUE},
        ):
            database = box("Supabase Data API\nPostgreSQL + RLS", "#FFFFFF", BLUE_BORDER)
            functions = box("Edge Functions\nchatbot · valuation · address lookup", "#FFFFFF", BLUE_BORDER)
            storage = box("Property image storage", "#FFFFFF", BLUE_BORDER)
            database >> Edge(label="trusted reads and writes", color=BLUE) >> functions

        with Cluster(
            "Server-side services",
            graph_attr={"style": "rounded,filled", "color": BLUE_BORDER, "bgcolor": "#F8FBFF", "fontcolor": DEEP_BLUE},
        ):
            inference = box("FastAPI inference\nVersioned CatBoost bundle", SOFT_BLUE, BLUE_BORDER)
            providers = box("OpenAI or OpenRouter\nprovider credentials server-side", NEUTRAL, NEUTRAL_BORDER)
            address = box("OneMap + HDB\naddress verification", NEUTRAL, NEUTRAL_BORDER)

        map_tiles = box("OpenStreetMap\nmap tiles", NEUTRAL, NEUTRAL_BORDER)
        browser >> Edge(label="session and app requests", color=BLUE) >> database
        browser >> Edge(label="uploads", color=BLUE) >> storage
        functions >> Edge(label="server-held bearer credential", color=GREEN, fontcolor=GREEN) >> inference
        functions >> Edge(label="server-side provider call", color=BLUE) >> providers
        functions >> Edge(label="address verification", color=BLUE) >> address
        browser >> Edge(label="map tiles", color=MUTED, fontcolor=MUTED) >> map_tiles


def ml_lifecycle() -> None:
    with render("ml-lifecycle", "Offline research and online inference"):
        with Cluster(
            "Offline training and research · MLPricePredictorV2",
            graph_attr={"style": "rounded,filled", "color": BLUE_BORDER, "bgcolor": SOFT_BLUE, "fontcolor": DEEP_BLUE},
        ):
            source = box("Official HDB resale transactions", "#FFFFFF", BLUE_BORDER)
            research = box("Prepare leakage-safe features\nChronological train / validation / test\nTrain and calibrate model")
            artifact = box("Versioned CatBoost bundle\nResearch/demo artifact", GREEN_SOFT, "#A7F3D0")
            source >> research >> artifact

        with Cluster(
            "Online inference · separate service",
            graph_attr={"style": "rounded,filled", "color": BLUE_BORDER, "bgcolor": "#F8FBFF", "fontcolor": DEEP_BLUE},
        ):
            deploy = box("Render build fetches\nselected artifact")
            api = box("FastAPI startup loads bundle\nValidated request → estimate + range", SOFT_BLUE, BLUE_BORDER)
            deploy >> api

        artifact >> Edge(label="released artifact; no training per request", color=GREEN, fontcolor=GREEN) >> deploy
        boundary = box("Research output; not production-approved", AMBER_SOFT, "#FCD34D")
        artifact >> Edge(style="dashed", color=AMBER, fontcolor=AMBER) >> boundary


def main() -> None:
    system_overview()
    ml_lifecycle()
    print(f"Generated two architecture diagrams in {ASSETS}")


if __name__ == "__main__":
    main()
