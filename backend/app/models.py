from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Job(Base):
    __tablename__ = 'jobs'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    total_websites = Column(Integer, default=0)
    completed_websites = Column(Integer, default=0)
    running_websites = Column(Integer, default=0)
    failed_websites = Column(Integer, default=0)
    status = Column(String, default='queued') # queued, running, finished, failed
    results = relationship('AuditResult', back_populates='job', cascade='all, delete-orphan')

class AuditResult(Base):
    __tablename__ = 'audit_results'
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id'))
    domain = Column(String, index=True)
    status = Column(String, default='Queued') # Queued, Fetching, Crawling, Screenshot, SEO Audit, Performance Audit, Accessibility Audit, Security Audit, UI Analysis, Finished, Failed
    error_log = Column(Text, nullable=True)
    screenshot_path_desktop = Column(String, nullable=True)
    screenshot_path_tablet = Column(String, nullable=True)
    screenshot_path_mobile = Column(String, nullable=True)
    
    # Scores
    score_overall = Column(Float, default=0.0)
    score_seo = Column(Float, default=0.0)
    score_performance = Column(Float, default=0.0)
    score_accessibility = Column(Float, default=0.0)
    score_security = Column(Float, default=0.0)
    score_responsive = Column(Float, default=0.0)
    score_design = Column(Float, default=0.0)
    
    # Audit info
    meta_info = Column(JSON, nullable=True) # title, description, h1s, image count, links etc.
    issues = Column(JSON, default=list) # [{category, problem, why_it_matters, recommendation, impact, priority, severity}]
    
    # Outreach info
    contact_email = Column(String, nullable=True)
    outreach_status = Column(String, default='Unsent') # Unsent, Sending, Sent, Failed
    outreach_error = Column(Text, nullable=True)
    outreach_sent_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    job = relationship('Job', back_populates='results')

class Settings(Base):
    __tablename__ = 'settings'
    id = Column(Integer, primary_key=True, default=1)
    concurrency = Column(Integer, default=3)
    timeout = Column(Integer, default=30)
    retry_count = Column(Integer, default=2)
    screenshot_resolution_desktop = Column(String, default='1920x1080')
    dark_mode = Column(Integer, default=1) # 1 = dark, 0 = light
    export_format = Column(String, default='csv')
    
    # SMTP Settings
    smtp_host = Column(String, default='smtp.gmail.com')
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String, default='')
    smtp_password = Column(String, default='')
    smtp_sender_name = Column(String, default='Audit Team')
    smtp_sender_email = Column(String, default='')
    smtp_use_tls = Column(Integer, default=1) # 1 = True, 0 = False
    
    # Email Template
    email_template_subject = Column(String, default='Website Audit Report for {domain}')
    email_template_body = Column(Text, default='Hi there,\n\nWe audited your website {domain} and found some performance and SEO issues. Your overall score is {score_overall}/100.\n\nBest regards,\nAudit Team')
