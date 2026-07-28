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
    outdated_only: bool = False

class SearchLeadResultSchema(BaseModel):
    title: str
    domain: str
    url: str
    snippet: str
    score_design: float
    is_outdated: bool
    outdated_reasons: List[str]
    contacts: ContactInfoSchema

class GMapsLeadSchema(BaseModel):
    name: str
    category: str
    rating: float
    reviews_count: int
    phone: str
    website: str
    address: str
    email: Optional[str] = ""
    emails: List[str] = []
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""
    linkedin: Optional[str] = ""
    whatsapp: Optional[str] = ""
    google_maps_url: Optional[str] = ""

class GMapsSearchRequest(BaseModel):
    keyword: str
    max_results: int = 15
    deep_enrich: bool = True

class SaveLeadsJobRequest(BaseModel):
    job_name: str
    leads: List[GMapsLeadSchema]
