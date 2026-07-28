import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "audit_pipeline.db"))

def migrate():
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Alter audit_results
    audit_results_cols = [
        ("contact_email", "VARCHAR"),
        ("outreach_status", "VARCHAR DEFAULT 'Unsent'"),
        ("outreach_error", "TEXT"),
        ("outreach_sent_at", "DATETIME")
    ]
    
    for col_name, col_type in audit_results_cols:
        try:
            cursor.execute(f"ALTER TABLE audit_results ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name} to audit_results")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print(f"Column {col_name} already exists in audit_results")
            else:
                print(f"Error adding {col_name} to audit_results: {e}")
                
    # Alter settings
    settings_cols = [
        ("smtp_host", "VARCHAR DEFAULT 'smtp.gmail.com'"),
        ("smtp_port", "INTEGER DEFAULT 587"),
        ("smtp_username", "VARCHAR DEFAULT ''"),
        ("smtp_password", "VARCHAR DEFAULT ''"),
        ("smtp_sender_name", "VARCHAR DEFAULT 'Audit Team'"),
        ("smtp_sender_email", "VARCHAR DEFAULT ''"),
        ("smtp_use_tls", "INTEGER DEFAULT 1"),
        ("email_template_subject", "VARCHAR DEFAULT 'Website Audit Report for {domain}'"),
        ("email_template_body", "TEXT DEFAULT 'Hi there,\n\nWe audited your website {domain} and found some performance and SEO issues. Your overall score is {score_overall}/100.\n\nBest regards,\nAudit Team'")
    ]
    
    for col_name, col_type in settings_cols:
        try:
            cursor.execute(f"ALTER TABLE settings ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name} to settings")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print(f"Column {col_name} already exists in settings")
            else:
                print(f"Error adding {col_name} to settings: {e}")
                
    conn.commit()
    conn.close()
    print("Migration finished successfully!")

if __name__ == "__main__":
    migrate()
