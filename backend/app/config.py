from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    MONGODB_URI: str = "mongodb+srv://balaji:<db_password>@balaji-work.g7a4o4n.mongodb.net/?appName=balaji-work"
    MONGODB_DB: str = "testgen_suite"

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o"
    AZURE_OPENAI_API_VERSION: str = "2024-02-01"

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_REPO_ID: str = ""

    # Vercel Deployments
    VERCEL_TOKEN: str = ""
    VERCEL_TEAM_ID: str = ""
    VERCEL_PROJECT_ID: str = ""
    VERCEL_PROJECT_NAME: str = ""

    # Jira
    JIRA_DOMAIN: str = "https://joulestowatts-balaji-testing.atlassian.net?continue=https%3A%2F%2Fjoulestowatts-balaji-testing.atlassian.net%2Fwelcome%2Fsoftware&atlOrigin=eyJpIjoiNzdiZjMxYTJjNjBmNGNjOTgwZDAwNjg5NWZhYmNmOWUiLCJwIjoiaiJ9"
    JIRA_EMAIL: str = "s.balaji@joulestowatts.com"
    JIRA_TOKEN: str = "ATATT3xFfGF0DYANzmCQnZGem2h_QdcLOz1i5jzfuFd-21O6QQey-A_25JJ76KgoTHWkalGh--Nxpq21fehQCU3PRo3NAqH_eAik09wT6PmDjOyTlFzbYGmB6t0dIromg915ujH0xpVK8lOn9yinkh8d43Gm9OPE5G9b9E_f4RYKot_MDI9t-TI=67BBAFAB"

    # Slack
    SLACK_WEBHOOK_URL: str = "https://hooks.slack.com/services/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"

    # Datadog
    DATADOG_API_KEY: str = "477f9e203e97b8a9a977e5b5a97035d"
    DATADOG_APP_KEY: str = "ddapp_muouvzeGlm3AM5bMvrYnRvOlm7ij4ef2Cm"

    # AI Workspace
    WORKSPACE_TEMP_DIR: str = "/tmp/workspaces"
    MAX_FILE_SIZE_KB: int = 500
    MAX_REPO_SIZE_MB: int = 100
    COMMIT_AUTHOR_NAME: str = "SDLC AI"
    COMMIT_AUTHOR_EMAIL: str = "ai@sdlc.dev"

    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:8080", "http://localhost:5173"]

    # PR Review Engine
    PR_REVIEW_V2_ENABLED: bool = True
    PR_REVIEW_MAX_FILES: int = 15
    PR_REVIEW_MAX_PATCH_CHARS: int = 3000
    PR_REVIEW_MAX_HUNKS_PER_FILE: int = 8

    @property
    def jira_base_url(self) -> str:
        """Extract clean Jira base URL from potentially messy JIRA_DOMAIN value."""
        domain = self.JIRA_DOMAIN.strip()
        if not domain:
            return ""
        # Strip query params if present
        if "?" in domain:
            domain = domain.split("?")[0]
        # Ensure https prefix
        if not domain.startswith("http"):
            domain = f"https://{domain}"
        return domain.rstrip("/")


settings = Settings()
