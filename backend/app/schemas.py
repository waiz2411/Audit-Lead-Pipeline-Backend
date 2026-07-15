from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class SettingsSchema(BaseModel):
    concurrency: int
    timeout: int
    retry_count: int
    screenshot_resolution_desktop: str
    dark_mode: int
    export_format: str

    class Config:
        from_attributes = True

class IssueSchema(BaseModel):
    category: str
    problem: str
    why_it_matters: str
    recommendation: str
    impact: str
    priority: str
    severity: str

class AuditResultSchema(BaseModel):
    id: int
    job_id: int
    domain: str
    status: str
    error_log: Optional[str]
    screenshot_path_desktop: Optional[str]
    screenshot_path_tablet: Optional[str]
    screenshot_path_mobile: Optional[str]
    score_overall: float
    score_seo: float
    score_performance: float
    score_accessibility: float
    score_security: float
    score_responsive: float
    score_design: float
    meta_info: Optional[Dict[str, Any]]
    issues: List[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class JobSchema(BaseModel):
    id: int
    name: str
    created_at: datetime
    total_websites: int
    completed_websites: int
    running_websites: int
    failed_websites: int
    status: str

    class Config:
        from_attributes = True

class JobDetailSchema(JobSchema):
    results: List[AuditResultSchema] = []

class ManualJobRequest(BaseModel):
    name: str
    domains: List[str]

