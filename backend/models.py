"""Pydantic models for VybeCod.ing Launch Ops API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def new_id() -> str:
    return str(uuid4())


def _not_blank(value: str | None) -> str | None:
    """Reject a null or whitespace-only name (validators only run when it was sent)."""
    if value is None or not value.strip():
        raise ValueError("name must not be empty")
    return value


# ─── Auth ───


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str


class NewPassword(BaseModel):
    password: str


# ─── Organisations ───

Role = Literal["owner", "approver", "editor", "viewer"]


class OrganisationUpdate(BaseModel):
    name: str


class MemberRoleUpdate(BaseModel):
    role: Role


class InvitationCreate(BaseModel):
    email: str
    role: Role


class BudgetUpdate(BaseModel):
    monthly_ai_budget_usd: Decimal | None = Field(ge=0, max_digits=12, decimal_places=2)


class InvitationRegistration(BaseModel):
    name: str = ""
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime


# ─── Enums ───


class ProductStatus(str, Enum):
    PRE_LAUNCH = "pre_launch"
    LAUNCHED = "launched"
    POST_LAUNCH = "post_launch"


class QueueStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PlatformMode(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


ProjectType = Literal["product", "service", "persona"]


# ─── Products ───


class EmailSettings(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_name: str = ""
    from_email: str = ""
    reply_to: str = ""
    use_tls: bool = True


class ProductCreate(BaseModel):
    name: str
    tagline: str = ""
    url: str = ""
    color: str = "#00f0ff"
    description: str = ""
    keywords: list[str] = []
    project_type: ProjectType = "product"
    launch_date: date | None = None
    brand_id: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    tagline: str | None = None
    url: str | None = None
    color: str | None = None
    status: ProductStatus | None = None
    description: str | None = None
    keywords: list[str] | None = None
    email_settings: dict | None = None
    company_details: dict | None = None
    project_type: ProjectType | None = None
    # An explicit null clears these (see routers/products.py NULLABLE_FIELDS)
    launch_date: date | None = None
    brand_id: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        return _not_blank(v)


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    tagline: str = ""
    url: str = ""
    color: str = "#00f0ff"
    status: ProductStatus = ProductStatus.PRE_LAUNCH
    description: str = ""
    keywords: list[str] = []
    press_kit: dict | None = None
    checklist: dict = {}
    seo_result: dict | None = None
    email_settings: dict = {}
    company_details: dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ─── Queue / Results ───


class QueueItem(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    workflow_id: str
    status: QueueStatus = QueueStatus.PENDING
    content: dict = {}
    preview: str = ""
    input_params: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class QueueUpdate(BaseModel):
    status: QueueStatus
    notes: str = ""


class EmailDraftUpdate(BaseModel):
    recipient_name: str | None = None
    recipient_email: str | None = None
    subject: str | None = None
    body: str | None = None


# ─── Workflows ───


class WorkflowRequest(BaseModel):
    product_id: str
    workflow_id: str
    instructions: str = ""


class WorkflowResponse(BaseModel):
    task_id: str
    status: TaskStatus
    message: str


# ─── Press Kit ───


class PressKitRequest(BaseModel):
    product_id: str
    url: str


class PressReleaseRequest(BaseModel):
    product_id: str
    url: str
    media_contact_name: str = ""
    media_contact_email: str = ""
    media_contact_phone: str = ""
    technical_contact_name: str = ""
    technical_contact_email: str = ""
    sales_contact_name: str = ""
    sales_contact_email: str = ""
    additional_notes: str = ""


class PressKit(BaseModel):
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    source_url: str
    boilerplate: str = ""
    key_features: list[str] = []
    target_audience: str = ""
    founder_bio: str = ""
    media_assets: list[str] = []
    contact: dict = {}


# ─── SEO ───


class SEORequest(BaseModel):
    product_id: str
    url: str


class SEOMetadata(BaseModel):
    title: str = ""
    description: str = ""
    og_title: str = ""
    og_description: str = ""
    og_image: str = ""
    canonical: str = ""
    robots: str = "index, follow"
    keywords: str = ""
    twitter_card: str = "summary_large_image"
    json_ld: str = ""


class SEOResult(BaseModel):
    current: dict = {}
    optimized: dict = {}
    issues: list[str] = []
    current_score: int = 0
    optimized_score: int = 0
    head_block: str = ""


# ─── Repurposer ───


class RepurposeRequest(BaseModel):
    product_id: str
    content: str
    platforms: list[str] = [
        "twitter", "instagram", "linkedin", "reddit", "tiktok", "facebook",
    ]


class RepurposedContent(BaseModel):
    platform: str
    content: str


# ─── Pricing ───


class PricingRequest(BaseModel):
    product_id: str
    notes: str = ""


class PricingTier(BaseModel):
    name: str
    price: str
    features: list[str]
    recommended: bool = False


class PricingResult(BaseModel):
    tiers: list[PricingTier] = []
    insights: list[str] = []


# ─── Market Analysis ───


class MarketAnalysisRequest(BaseModel):
    product_id: str
    custom_pricing: str = ""  # Optional user-provided pricing override


# ─── Templates ───


class TemplateCreate(BaseModel):
    name: str
    type: str  # email, social, blog, content, ads
    tags: list[str] = []
    content: str
    source_product: str = ""


class Template(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    type: str
    tags: list[str] = []
    content: str
    source_product: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ─── Calendar ───


class CalendarEventCreate(BaseModel):
    date: date
    product_id: str
    platform: str
    title: str


# Alias: a field named `date` would otherwise shadow the type in its own annotation.
EventDate = date


class CalendarEventUpdate(BaseModel):
    """Reschedule or edit an entry. Omitted (or null) fields are left unchanged."""
    date: EventDate | None = None
    product_id: str | None = None
    platform: str | None = None
    title: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str | None) -> str | None:
        return _not_blank(v)


class CalendarEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    date: date
    product_id: str
    product_name: str = ""
    platform: str
    title: str
    color: str = "#00f0ff"


# ─── Quick Captures ───


class CaptureCreate(BaseModel):
    text: str
    product_id: str


class Capture(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    product_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ─── Settings ───


class PlatformConfig(BaseModel):
    connected: bool = False
    handle: str = ""
    mode: PlatformMode = PlatformMode.MANUAL


class BrandSettings(BaseModel):
    name: str = "VybeCod.ing"
    tagline: str = ""
    tone: str = "creative"
    keywords: list[str] = []
    avoid: list[str] = []
    elevator: str = ""
    # White-label header branding
    company_name: str = ""
    logo_url: str = ""


class AgentPrefs(BaseModel):
    depth: str = "thorough"
    length: str = "medium"
    emoji: bool = True
    hashtags: str = "moderate"
    sources: bool = True


class GlobalSettings(BaseModel):
    platforms: dict[str, PlatformConfig] = {}
    brand: BrandSettings = BrandSettings()
    prefs: AgentPrefs = AgentPrefs()


# ─── Brands ───


class BrandUpdate(BaseModel):
    """Brand fields a client may set. Unknown keys (founders, id, user_id...) are ignored."""

    name: str | None = None
    tagline: str | None = None
    tone: str | None = None
    keywords: list[str] | None = None
    avoid: list[str] | None = None
    elevator: str | None = None
    company_name: str | None = None
    industry: str | None = None
    location: str | None = None
    founded: str | None = None
    founder_name: str | None = None
    founder_title: str | None = None
    phone: str | None = None
    email: str | None = None
    company_size: str | None = None
    boilerplate: str | None = None
    logo_url: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        return _not_blank(v)


class BrandCreate(BrandUpdate):
    name: str
