"""Agent registry. Each module exposes AGENT metadata and run(payload) -> dict."""
from . import (
    a01_brief_extractor, a02_programme_reads, a03_source_enrichment, a04_cohort, a05_narratives,
    a06_channels, a07_ranker, a08_content, a09_predictor, a10_compliance, a11_listening,
    a12_diagnosis, copilot,
)

MODULES = [
    a01_brief_extractor, a02_programme_reads, a03_source_enrichment, a04_cohort, a05_narratives,
    a06_channels, a07_ranker, a08_content, a09_predictor, a10_compliance, a11_listening,
    a12_diagnosis, copilot,
]
REGISTRY = {m.AGENT["id"].lower(): m for m in MODULES}
