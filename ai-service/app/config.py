"""Runtime configuration for the Hire IQ AI service (env-driven only).

Business options, thresholds and priors are NOT configured here: they live in
MySQL and arrive with every request from the Node backend, so the AI service is
stateless and nothing business-related is hard-coded.
"""
import os


class Settings:
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "2000"))
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "30.0"))
    llm_max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "2"))
    service_key: str = os.getenv("AI_SERVICE_KEY", "change-me")
    youtube_api_key: str = os.getenv("YOUTUBE_API_KEY", "")
    meta_graph_token: str = os.getenv("META_GRAPH_TOKEN", "")
    research_api_key: str = os.getenv("RESEARCH_API_KEY", "")

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()

