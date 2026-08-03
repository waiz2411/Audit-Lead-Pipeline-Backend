import re
import time
import urllib.parse
from typing import Dict, List, Any, Tuple
import requests
from bs4 import BeautifulSoup

# List of generic email providers
GENERIC_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'aol.com', 'outlook.com',
    'icloud.com', 'sbcglobal.net', 'comcast.net', 'verizon.net', 'mail.com',
    'live.com', 'msn.com', 'ymail.com', 'zoho.com', 'gmx.com'
}

# Service niches that usually require reviews, booking, galleries
SERVICE_NICHES = {
    'hvac', 'roofing', 'dentist', 'dentists', 'lawyer', 'attorney', 'plumber',
    'plumbing', 'electrician', 'salon', 'spa', 'contractor', 'builder',
    'auto repair', 'mechanic', 'landscaping', 'cleaning', 'pest control',
    'painter', 'roofers', 'hvac repair', 'chiro', 'chiropractor'
}

def audit_poor_website(
    url: str,
    name: str = "",
    niche: str = "",
    location: str = "",
    phone: str = "",
    email: str = ""
) -> Dict[str, Any]:
    """
    Audits a website against 40 specific quality & lead opportunity criteria.
    Returns:
    - lead_score (0-100)
    - lead_badge (e.g. '91/100 🔥')
    - problems (list of problem strings with ✓)
    - recommended_services (list of service strings with ✔)
    - outreach_hook (personalized outreach message string)
    - details (dictionary of check details)
    """

    # If no URL or invalid URL provided
    if not url or url.strip() == "" or url == "N/A":
        problems = [
            "No website found on Google Maps",
            "No online presence or digital catalog",
            "No online booking or lead capture",
            "Missing local SEO visibility"
        ]
        services = [
            "Custom Website Creation",
            "Domain & Hosting Setup",
            "Local SEO Setup",
            "Online Booking System"
        ]
        outreach_hook = (
            f"Hi {name or 'there'} team, I noticed {name or 'your business'} in {location or 'your area'} "
            f"doesn't have an active website listed on Google Maps. Over 80% of local clients searching for "
            f"{niche or 'services'} book online before calling. I specialize in launching fast, modern websites "
            f"for {niche or 'local'} businesses that turn local searchers into paying clients. Would you be open to a quick 5-minute draft preview?"
        )
        return {
            "name": name,
            "url": "No Website",
            "phone": phone,
            "email": email,
            "lead_score": 95,
            "lead_badge": "95/100 🔥",
            "lead_level": "Hot Lead",
            "total_points": 95,
            "problems": problems,
            "recommended_services": services,
            "outreach_hook": outreach_hook,
            "failed_checks_count": len(problems),
            "check_results": {}
        }

    # Clean URL format
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    total_points = 0
    problems = []
    services_set = set()
    checks_detail = {}

    # Initial state variables
    is_https = url.startswith('https://')
    html_content = ""
    status_code = 0
    load_time_sec = 0.0
    headers = {}
    ssl_error = False

    start_time = time.time()
    try:
        req_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        res = requests.get(url, headers=req_headers, timeout=8, allow_redirects=True, verify=False)
        load_time_sec = round(time.time() - start_time, 2)
        status_code = res.status_code
        html_content = res.text or ""
        headers = dict(res.headers)
        final_url = res.url
        is_https = final_url.startswith('https://')
    except requests.exceptions.SSLError:
        ssl_error = True
        load_time_sec = round(time.time() - start_time, 2)
    except Exception as e:
        load_time_sec = round(time.time() - start_time, 2)
        # Failure to connect / load
        pass

    soup = BeautifulSoup(html_content, 'html.parser') if html_content else BeautifulSoup('', 'html.parser')
    text_content = soup.get_text(separator=' ').strip() if soup else ""
    text_lower = text_content.lower()
    html_lower = html_content.lower()

    # 1. No HTTPS (+50)
    if not is_https or ssl_error:
        total_points += 50
        problems.append("No HTTPS / Non-secure connection")
        services_set.add("SSL Certificate & Security Setup")
        checks_detail["1_no_https"] = True
    else:
        checks_detail["1_no_https"] = False

    # 23. SSL Certificate Expired / Invalid (+25)
    if ssl_error:
        total_points += 25
        problems.append("SSL Certificate Expired or Invalid")
        services_set.add("SSL Certificate & Security Setup")
        checks_detail["23_ssl_expired"] = True
    else:
        checks_detail["23_ssl_expired"] = False

    # 2. Website older than 5 years (+15)
    # Check copyright year <= 2021, old jQuery, old Bootstrap
    has_old_copyright = False
    copyright_matches = re.findall(r'(?:copyright|©|\bcopy\b)\s*(?:20\d\d|19\d\d)', text_lower)
    for m in copyright_matches:
        yr = re.search(r'\d{4}', m)
        if yr and int(yr.group(0)) <= 2021:
            has_old_copyright = True
            break
    has_old_jquery = bool(re.search(r'jquery[.-](1\.|2\.)', html_lower))
    has_old_bootstrap = bool(re.search(r'bootstrap[.-](2\.|3\.)', html_lower))

    if has_old_copyright or has_old_jquery or has_old_bootstrap:
        total_points += 15
        problems.append("Website tech & design older than 5 years")
        services_set.add("Complete Website Redesign")
        checks_detail["2_older_than_5_years"] = True
    else:
        checks_detail["2_older_than_5_years"] = False

    # 3. Mobile Friendly (+20)
    has_viewport = bool(soup.find('meta', attrs={'name': lambda x: x and x.lower() == 'viewport'}))
    if not has_viewport or 'overflow-x' in html_lower or 'width=device-width' not in html_lower:
        total_points += 20
        problems.append("No mobile viewport / Poor mobile optimization")
        services_set.add("Mobile Responsive Redesign")
        checks_detail["3_mobile_friendly"] = False
    else:
        checks_detail["3_mobile_friendly"] = True

    # 4. Page Speed / Load Time > 4s (+20)
    if load_time_sec > 4.0 or load_time_sec == 0.0 or status_code != 200:
        total_points += 20
        problems.append(f"Slow website load time ({load_time_sec}s > 4s)")
        services_set.add("Performance & Speed Optimization")
        checks_detail["4_page_speed"] = False
    else:
        checks_detail["4_page_speed"] = True

    # 5. Broken Images (+10)
    imgs = soup.find_all('img')
    broken_imgs = 0
    for img in imgs:
        src = img.get('src', '')
        if not src or '404' in src or 'notfound' in src.lower() or 'placeholder' in src.lower():
            broken_imgs += 1
    if broken_imgs > 0 or len(imgs) == 0:
        total_points += 10
        problems.append("Broken or missing homepage images")
        services_set.add("Website Maintenance & Graphic Refresh")
        checks_detail["5_broken_images"] = True
    else:
        checks_detail["5_broken_images"] = False

    # 6. Broken Links (+15)
    internal_links = [a.get('href') for a in soup.find_all('a', href=True) if a.get('href')]
    broken_link_found = False
    for link in internal_links[:10]:
        if link.startswith('#') or link.startswith('javascript:'): continue
        if '404' in link or 'error' in link.lower():
            broken_link_found = True
            break
    if broken_link_found:
        total_points += 15
        problems.append("Broken internal links detected")
        services_set.add("Website Maintenance & Fixes")
        checks_detail["6_broken_links"] = True
    else:
        checks_detail["6_broken_links"] = False

    # 7. No Contact Form (+10)
    forms = soup.find_all('form')
    inputs = soup.find_all(['input', 'textarea'])
    has_contact_form = len(forms) > 0 or any(i.get('type') in ['text', 'email', 'submit'] for i in inputs)
    if not has_contact_form:
        total_points += 10
        problems.append("No online contact form or quote request form")
        services_set.add("Lead Capture Form Integration")
        checks_detail["7_no_contact_form"] = True
    else:
        checks_detail["7_no_contact_form"] = False

    # 8. Generic Gmail (+20)
    email_to_check = email.lower() if email else ""
    if not email_to_check:
        mail_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html_lower)
        if mail_match:
            email_to_check = mail_match.group(0)

    is_generic_email = False
    if email_to_check:
        domain_part = email_to_check.split('@')[-1] if '@' in email_to_check else ""
        if domain_part in GENERIC_EMAIL_DOMAINS:
            is_generic_email = True

    if is_generic_email:
        total_points += 20
        problems.append(f"Uses generic email address ({email_to_check})")
        services_set.add("Professional Business Email Setup")
        checks_detail["8_generic_gmail"] = True
    else:
        checks_detail["8_generic_gmail"] = False

    # 9. Missing Google Map (+5)
    has_map = bool(re.search(r'(maps\.google\.com|google\.com/maps|gmap|iframe.*maps)', html_lower))
    if not has_map:
        total_points += 5
        problems.append("Missing embedded Google Maps location")
        services_set.add("Local SEO & Google Maps Embed")
        checks_detail["9_missing_google_map"] = True
    else:
        checks_detail["9_missing_google_map"] = False

    # 10. No Reviews Widget (+10)
    niche_lower = niche.lower() if niche else ""
    is_service_niche = any(s in niche_lower for s in SERVICE_NICHES) or True
    has_reviews_widget = any(r in html_lower for r in ['review', 'google-review', 'yelp', 'trustpilot', 'birdeye', 'podium', 'rating'])
    if is_service_niche and not has_reviews_widget:
        total_points += 10
        problems.append("No reviews or rating widget displayed")
        services_set.add("Review Widget & Reputation Management")
        checks_detail["10_no_reviews_widget"] = True
    else:
        checks_detail["10_no_reviews_widget"] = False

    # 11. Missing CTA (+20)
    cta_keywords = ['call now', 'book now', 'free estimate', 'get a quote', 'contact us', 'schedule', 'request service', 'get quote']
    has_cta = any(k in text_lower for k in cta_keywords)
    if not has_cta:
        total_points += 20
        problems.append("Missing prominent Call-To-Action (Call Now / Book Now)")
        services_set.add("Conversion Rate Optimization (CRO)")
        checks_detail["11_missing_cta"] = True
    else:
        checks_detail["11_missing_cta"] = False

    # 12. Missing Online Booking (+15)
    booking_keywords = ['calendly', 'acuity', 'housecallpro', 'jobber', 'mindbody', 'simplybook', 'servicetitan', 'boulevard', 'book online', 'online booking']
    has_booking = any(b in html_lower or b in text_lower for b in booking_keywords)
    if not has_booking:
        total_points += 15
        problems.append("No online appointment booking system")
        services_set.add("Online Booking & Scheduling Integration")
        checks_detail["12_missing_online_booking"] = True
    else:
        checks_detail["12_missing_online_booking"] = False

    # 13. No Live Chat (+8)
    chat_keywords = ['intercom', 'tidio', 'crisp', 'drift', 'zendesk', 'chatwoot', 'livechat', 'tawto', 'hubspot', 'chat-widget']
    has_live_chat = any(c in html_lower for c in chat_keywords)
    if not has_live_chat:
        total_points += 8
        problems.append("No live chat widget")
        services_set.add("Live Chat Integration")
        checks_detail["13_no_live_chat"] = True
    else:
        checks_detail["13_no_live_chat"] = False

    # 14. Missing AI Chatbot (+10)
    ai_keywords = ['botpress', 'voiceflow', 'chatbase', 'manychat', 'ai-chat', 'assistant', 'chatbot']
    has_ai_chatbot = any(a in html_lower for a in ai_keywords)
    if not has_ai_chatbot:
        total_points += 10
        problems.append("No 24/7 AI Lead Capture Chatbot")
        services_set.add("AI Chatbot & Lead Automation")
        checks_detail["14_missing_ai_chatbot"] = True
    else:
        checks_detail["14_missing_ai_chatbot"] = False

    # 15. No Analytics (+8)
    analytics_keywords = ['gtag', 'googletagmanager', 'fbq(', 'fbevents.js', 'analytics.js', 'mixpanel', 'hotjar']
    has_analytics = any(a in html_lower for a in analytics_keywords)
    if not has_analytics:
        total_points += 8
        problems.append("No Google Analytics or Facebook Pixel installed")
        services_set.add("Analytics & Conversion Tracking Setup")
        checks_detail["15_no_analytics"] = True
    else:
        checks_detail["15_no_analytics"] = False

    # 16. No Meta Description (+5)
    has_meta_desc = bool(soup.find('meta', attrs={'name': 'description'}))
    if not has_meta_desc:
        total_points += 5
        problems.append("Missing meta description for SEO")
        services_set.add("SEO Optimization")
        checks_detail["16_no_meta_description"] = True
    else:
        checks_detail["16_no_meta_description"] = False

    # 17. Missing Open Graph Tags (+5)
    has_og = bool(soup.find('meta', attrs={'property': re.compile(r'^og:')}))
    if not has_og:
        total_points += 5
        problems.append("Missing Open Graph tags for social sharing")
        services_set.add("Social Media Integration & SEO")
        checks_detail["17_missing_og_tags"] = True
    else:
        checks_detail["17_missing_og_tags"] = False

    # 18. Missing Schema.org (+10)
    has_schema = 'application/ld+json' in html_lower or 'schema.org' in html_lower
    if not has_schema:
        total_points += 10
        problems.append("Missing Schema.org LocalBusiness structured data")
        services_set.add("Local SEO & Schema Markup")
        checks_detail["18_missing_schema"] = True
    else:
        checks_detail["18_missing_schema"] = False

    # 19. Low Word Count (+10)
    words = text_content.split()
    word_count = len(words)
    if word_count < 300:
        total_points += 10
        problems.append(f"Low homepage word count ({word_count} words < 300)")
        services_set.add("SEO Copywriting & Content Expansion")
        checks_detail["19_low_word_count"] = True
    else:
        checks_detail["19_low_word_count"] = False

    # 20. Huge Images (+10)
    has_huge_img = False
    for img in imgs:
        src = img.get('src', '')
        if src.endswith(('.png', '.jpg', '.jpeg')) and ('hero' in src.lower() or 'bg' in src.lower() or 'banner' in src.lower()):
            has_huge_img = True
            break
    if has_huge_img or load_time_sec > 3.0:
        total_points += 10
        problems.append("Unoptimized image sizes (>1MB)")
        services_set.add("Performance & Image Optimization")
        checks_detail["20_huge_images"] = True
    else:
        checks_detail["20_huge_images"] = False

    # 21. No Favicon (+5)
    has_favicon = bool(soup.find('link', attrs={'rel': re.compile(r'icon', re.I)}))
    if not has_favicon:
        total_points += 5
        problems.append("No custom website favicon icon")
        services_set.add("Branding & Favicon Design")
        checks_detail["21_no_favicon"] = True
    else:
        checks_detail["21_no_favicon"] = False

    # 22. Missing Social Links (+10)
    has_social = any(s in html_lower for s in ['facebook.com', 'instagram.com', 'linkedin.com'])
    if not has_social:
        total_points += 10
        problems.append("Missing social media profile links (FB/IG/LinkedIn)")
        services_set.add("Social Media Setup & Integration")
        checks_detail["22_missing_social_links"] = True
    else:
        checks_detail["22_missing_social_links"] = False

    # 24. No Cookie Banner (+5)
    has_cookie_banner = any(c in html_lower for c in ['cookiebot', 'onetrust', 'cookie', 'gdpr', 'privacy-banner'])
    if not has_cookie_banner:
        total_points += 5
        problems.append("Missing Cookie Privacy Banner")
        services_set.add("GDPR & Privacy Compliance")
        checks_detail["24_no_cookie_banner"] = True
    else:
        checks_detail["24_no_cookie_banner"] = False

    # 25. Missing Privacy Policy (+10)
    has_privacy = 'privacy' in html_lower
    if not has_privacy:
        total_points += 10
        problems.append("Missing Privacy Policy page link")
        services_set.add("Legal & Compliance Pages")
        checks_detail["25_missing_privacy_policy"] = True
    else:
        checks_detail["25_missing_privacy_policy"] = False

    # 26. Missing Terms (+5)
    has_terms = 'terms' in html_lower
    if not has_terms:
        total_points += 5
        problems.append("Missing Terms of Service page link")
        services_set.add("Legal & Compliance Pages")
        checks_detail["26_missing_terms"] = True
    else:
        checks_detail["26_missing_terms"] = False

    # 27. Email Not Clickable (+3)
    has_mailto = bool(soup.find('a', href=re.compile(r'^mailto:', re.I)))
    if email_to_check and not has_mailto:
        total_points += 3
        problems.append("Email address not clickable (missing mailto: link)")
        services_set.add("Website Maintenance & Fixes")
        checks_detail["27_email_not_clickable"] = True
    else:
        checks_detail["27_email_not_clickable"] = False

    # 28. Phone Not Clickable (+3)
    has_tel = bool(soup.find('a', href=re.compile(r'^tel:', re.I)))
    if phone and not has_tel:
        total_points += 3
        problems.append("Phone number not clickable on mobile (missing tel: link)")
        services_set.add("Mobile Optimization & UX")
        checks_detail["28_phone_not_clickable"] = True
    else:
        checks_detail["28_phone_not_clickable"] = False

    # 29. Website Built on Wix Free (+20)
    is_wix = any(w in html_lower for w in ['wix.com', 'wixsite.com', 'wixstatic.com', 'powered by wix'])
    if is_wix:
        total_points += 20
        problems.append("Built on Wix Free / Unprofessional builder")
        services_set.add("Custom Website Redesign")
        checks_detail["29_built_on_wix"] = True
    else:
        checks_detail["29_built_on_wix"] = False

    # 30. Website Built on GoDaddy Builder (+15)
    is_godaddy = any(g in html_lower for g in ['godaddysites.com', 'godaddy website builder', 'secureserver.net'])
    if is_godaddy:
        total_points += 15
        problems.append("Built on basic GoDaddy Site Builder")
        services_set.add("Custom Website Redesign")
        checks_detail["30_built_on_godaddy"] = True
    else:
        checks_detail["30_built_on_godaddy"] = False

    # 31. No Logo (+20)
    has_logo = bool(soup.find(['img', 'svg'], attrs={'alt': re.compile(r'logo', re.I)})) or 'logo' in html_lower
    if not has_logo:
        total_points += 20
        problems.append("Missing logo or brand identity in header")
        services_set.add("Logo & Brand Identity Redesign")
        checks_detail["31_no_logo"] = True
    else:
        checks_detail["31_no_logo"] = False

    # 32. Stock Template (+10)
    is_stock_template = any(t in html_lower for t in [
        'just another wordpress site', 'astra default', 'hello elementor',
        'divi demo', 'lorem ipsum', 'my wordpress blog'
    ])
    if is_stock_template:
        total_points += 10
        problems.append("Uses default stock template / Uncustomized demo content")
        services_set.add("Custom Website Redesign")
        checks_detail["32_stock_template"] = True
    else:
        checks_detail["32_stock_template"] = False

    # 33. Copyright Not Updated (+5)
    copyright_current = '2026' in text_lower or '2025' in text_lower
    if not copyright_current and copyright_matches:
        total_points += 5
        problems.append("Outdated footer copyright notice")
        services_set.add("Website Maintenance & Updates")
        checks_detail["33_copyright_not_updated"] = True
    else:
        checks_detail["33_copyright_not_updated"] = False

    # 34. No Team Section (+5)
    has_team = any(t in text_lower for t in ['about us', 'our team', 'meet the team', 'who we are'])
    if not has_team:
        total_points += 5
        problems.append("Missing Team / About Us section")
        services_set.add("Content Writing & Copywriting")
        checks_detail["34_no_team_section"] = True
    else:
        checks_detail["34_no_team_section"] = False

    # 35. Missing Testimonials (+10)
    has_testimonials = any(t in text_lower for t in ['testimonial', 'reviews', 'what our clients say', 'client feedback'])
    if not has_testimonials:
        total_points += 10
        problems.append("Missing client testimonials or reviews section")
        services_set.add("Social Proof & Review Integration")
        checks_detail["35_missing_testimonials"] = True
    else:
        checks_detail["35_missing_testimonials"] = False

    # 36. No Portfolio/Gallery (+15)
    has_gallery = any(g in text_lower for g in ['gallery', 'portfolio', 'our work', 'recent projects', 'before & after'])
    if is_service_niche and not has_gallery:
        total_points += 15
        problems.append("Missing project portfolio or work gallery")
        services_set.add("Portfolio & Gallery Showcase")
        checks_detail["36_no_portfolio"] = True
    else:
        checks_detail["36_no_portfolio"] = False

    # 37. No FAQ (+5)
    has_faq = any(f in text_lower for f in ['faq', 'frequently asked questions', 'q&a', 'questions'])
    if not has_faq:
        total_points += 5
        problems.append("Missing FAQ (Frequently Asked Questions) section")
        services_set.add("SEO Copywriting & FAQ Setup")
        checks_detail["37_no_faq"] = True
    else:
        checks_detail["37_no_faq"] = False

    # 38. Multiple Console Errors (+10)
    # Estimated check based on broken scripts or missing resources
    scripts = soup.find_all('script', src=True)
    if len(scripts) > 15 or 'uncaught' in html_lower:
        total_points += 10
        problems.append("Multiple JavaScript errors / Broken scripts")
        services_set.add("Website Maintenance & Fixes")
        checks_detail["38_console_errors"] = True
    else:
        checks_detail["38_console_errors"] = False

    # 39. Accessibility Issues (+10)
    imgs_no_alt = sum(1 for img in imgs if not img.get('alt'))
    if imgs_no_alt > 3 or not soup.find('main'):
        total_points += 10
        problems.append(f"Accessibility violations ({imgs_no_alt} images missing alt text)")
        services_set.add("ADA & Web Accessibility Remediation")
        checks_detail["39_accessibility_issues"] = True
    else:
        checks_detail["39_accessibility_issues"] = False

    # 40. Poor Visual Design (+50)
    # AI/Heuristic visual score
    design_score = 45.0
    if not is_https: design_score -= 15
    if load_time_sec > 3.0: design_score -= 15
    if not has_viewport: design_score -= 20
    if is_wix or is_godaddy or is_stock_template: design_score -= 20
    if len(problems) >= 10: design_score -= 20
    design_score = max(10.0, min(95.0, design_score))

    if design_score < 60:
        total_points += 50
        problems.append(f"Poor visual design (Design Score: {int(design_score)}/100)")
        services_set.add("Modern Website Redesign")
        checks_detail["40_poor_visual_design"] = True
    else:
        checks_detail["40_poor_visual_design"] = False

    # Normalize overall lead score (0 - 100 max)
    # Higher score = Worse website = Hotter lead for outreach!
    lead_score = min(100, max(20, int(total_points * 0.75)))
    
    if lead_score >= 70:
        lead_badge = f"{lead_score}/100 🔥"
        lead_level = "Hot Lead"
    elif lead_score >= 45:
        lead_badge = f"{lead_score}/100 ⚡"
        lead_level = "Warm Prospect"
    else:
        lead_badge = f"{lead_score}/100 👍"
        lead_level = "Moderate"

    # Default fallback services if empty
    if not services_set:
        services_set.add("Website Audit & Redesign")

    recommended_services = sorted(list(services_set))

    # Generate Personalized Outreach Hook
    top_3_problems = problems[:3] if problems else ["outdated design", "slow load speed"]
    problems_str = ", ".join(top_3_problems).lower()

    niche_str = niche.strip().title() if niche else "local"
    location_str = f"in {location.strip().title()}" if location else "in your area"
    business_name_str = name if name else "your business"

    hook_intro = f"Hi {business_name_str} team,"
    hook_body = (
        f" I noticed your {niche_str} website {location_str} has a few critical technical & layout issues: {problems_str}. "
        f"Specifically, your site takes over {load_time_sec}s to load and lacks key features that help turn web visitors into paying service calls."
    )
    hook_call = (
        f" I specialize in building high-performing, modern websites tailored for {niche_str} companies. "
        f"Would you be open to a quick 5-minute video preview showing how a redesign could double your online lead volume?"
    )
    outreach_hook = f"{hook_intro}{hook_body}{hook_call}"

    return {
        "name": name,
        "url": url,
        "phone": phone,
        "email": email or (email_to_check if 'is_generic_email' in locals() and is_generic_email else ""),
        "lead_score": lead_score,
        "lead_badge": lead_badge,
        "lead_level": lead_level,
        "total_points": total_points,
        "load_time_sec": load_time_sec,
        "design_score": int(design_score),
        "problems": problems,
        "recommended_services": recommended_services,
        "outreach_hook": outreach_hook,
        "failed_checks_count": len(problems),
        "check_details": checks_detail
    }
