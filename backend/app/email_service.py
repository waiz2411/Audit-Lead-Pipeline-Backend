import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def render_template(template: str, context: dict) -> str:
    """
    Replaces placeholders like {domain}, {score_overall}, {issues_summary} with actual values.
    """
    if not template:
        return ""
    for key, val in context.items():
        placeholder = f"{{{key}}}"
        template = template.replace(placeholder, str(val))
    return template

def send_smtp_email(settings, recipient_email: str, subject: str, body: str):
    """
    Sends an email using the provided SMTP configurations in Settings model.
    """
    if not settings.smtp_host or not settings.smtp_port:
        raise Exception("SMTP Configuration is incomplete. SMTP Host and Port must be configured.")

    # Create message container
    msg = MIMEMultipart()
    sender_addr = settings.smtp_sender_email or settings.smtp_username
    msg['From'] = f"{settings.smtp_sender_name} <{sender_addr}>"
    msg['To'] = recipient_email
    msg['Subject'] = subject

    # Attach text body
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    # Create SMTP connection
    port = int(settings.smtp_port)
    
    # Check if TLS or standard
    if settings.smtp_use_tls == 1:
        server = smtplib.SMTP(settings.smtp_host, port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
    else:
        server = smtplib.SMTP(settings.smtp_host, port, timeout=15)
        server.ehlo()

    if settings.smtp_username and settings.smtp_password:
        server.login(settings.smtp_username, settings.smtp_password)

    server.sendmail(sender_addr, recipient_email, msg.as_string())
    server.quit()
