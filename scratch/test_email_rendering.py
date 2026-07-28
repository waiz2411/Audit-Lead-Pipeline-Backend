import sys
import os

# Adjust path to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.email_service import render_template

def test_rendering():
    template_subject = "Website Audit Report for {domain}"
    template_body = "Hi there,\n\nWe audited your website {domain} and found some performance and SEO issues. Your overall score is {score_overall}/100.\n\nIssues:\n{issues_summary}\n\nBest regards,\nAudit Team"
    
    context = {
        "domain": "example.com",
        "score_overall": 85.5,
        "issues_summary": "- Performance score is below 90\n- Missing meta description"
    }
    
    rendered_subject = render_template(template_subject, context)
    rendered_body = render_template(template_body, context)
    
    print("=== SUBJECT ===")
    print(rendered_subject)
    print("=== BODY ===")
    print(rendered_body)
    
    assert rendered_subject == "Website Audit Report for example.com"
    assert "85.5" in rendered_body
    print("\nTest passed successfully!")

if __name__ == "__main__":
    test_rendering()
