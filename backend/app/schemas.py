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
    smtp_host: Optional[str] = 'smtp.gmail.com'
    smtp_port: Optional[int] = 587
    smtp_username: Optional[str] = ''
    smtp_password: Optional[str] = ''
    smtp_sender_name: Optional[str] = 'Audit Team'
    smtp_sender_email: Optional[str] = ''
    smtp_use_tls: Optional[int] = 1
    email_template_subject: Optional[str] = 'Website Audit Report for {domain}'
    email_template_body: Optional[str] = 'Hi there,\n\nWe audited your website {domain} and found some performance and SEO issues. Your overall score is {score_overall}/100.\n\nBest regards,\nAudit Team'

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
    contact_email: Optional[str] = None
    outreach_status: Optional[str] = 'Unsent'
    outreach_error: Optional[str] = None
    outreach_sent_at: Optional[datetime] = None
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

class ContactUpdateRequest(BaseModel):
    contact_email: Optional[str] = None

class OutreachRequest(BaseModel):
    recipient_email: str
    subject: Optional[str] = None
    body: Optional[str] = None

class ContactInfoSchema(BaseModel):
    emails: List[str] = []
    instagram: List[str] = []
    facebook: List[str] = []
    linkedin: List[str] = []
    whatsapp: List[str] = []
    phones: List[str] = []

class KeywordSearchRequest(BaseModel):
    keyword: str
    max_results: int = 15
    outdated_only: bool = True

class SearchLeadResultSchema(BaseModel):
    title: str
    domain: str
    url: str
    snippet: str
    score_design: float
    is_outdated: bool
    outdated_reasons: List[str]
    contacts: ContactInfoSchema

class SaveLeadsJobRequest(BaseModel):
    job_name: str
    leads: List[SearchLeadResultSchema]




