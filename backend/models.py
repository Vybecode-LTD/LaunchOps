"""Pydantic models for VybeCod.ing Launch Ops API."""

from __future__ import annotations
from datetime import datetime, date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from uuid import uuid4


def new_id() -> str:
    return str(uuid4())


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


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    url: Optional[str] = None
    color: Optional[str] = None
    status: Optional[ProductStatus] = None
    description: Optional[str] = None
    keywords: Optional[list[str]] = None
    email_settings: Optional[dict] = None


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    tagline: str = ""
    url: str = ""
    color: str = "#00f0ff"
    status: ProductStatus = ProductStatus.PRE_LAUNCH
    description: str = ""
    keywords: list[str] = []
    press_kit: Optional[dict] = None
    checklist: dict = {}
    seo_result: Optional[dict] = None
    email_settings: dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Queue / Results ───


class QueueItem(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    workflow_id: str
    status: QueueStatus = QueueStatus.PENDING
    content: dict = {}
    preview: str = ""
    input_params: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QueueUpdate(BaseModel):
    status: QueueStatus
    notes: str = ""


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


class PressKit(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
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
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Calendar ───


class CalendarEventCreate(BaseModel):
    date: date
    product_id: str
    platform: str
    title: str


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
    created_at: datetime = Field(default_factory=datetime.utcnow)


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
