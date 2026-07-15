def run_security_audit(headers: dict, is_https: bool) -> tuple[float, list]:
    issues = []
    
    # Headers are usually lowercase keys in Python framework response but can vary
    hdrs = {k.lower(): v for k, v in headers.items()}
    
    if not is_https:
        issues.append({
            'category': 'Security',
            'problem': 'Website is not served over HTTPS',
            'why_it_matters': 'Data sent between the browser and server is unencrypted, exposing credentials and personal information to interception.',
            'recommendation': 'Install an SSL certificate and redirect all HTTP requests to HTTPS.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
    else:
        # HSTS only matters on HTTPS
        if 'strict-transport-security' not in hdrs:
            issues.append({
                'category': 'Security',
                'problem': 'HSTS Header Not Enabled',
                'why_it_matters': 'HTTP Strict Transport Security protects against SSL-stripping man-in-the-middle attacks.',
                'recommendation': 'Configure your server to send the Strict-Transport-Security header.',
                'impact': 'Medium',
                'priority': 'Medium',
                'severity': 'Medium'
            })
            
    if 'content-security-policy' not in hdrs:
        issues.append({
            'category': 'Security',
            'problem': 'Content Security Policy (CSP) Not Configured',
            'why_it_matters': 'A strong CSP restricts the locations that resources can be loaded from, mitigating XSS risks.',
            'recommendation': 'Add a Content-Security-Policy header defining trusted script/style sources.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
        
    if 'x-frame-options' not in hdrs and 'frame-ancestors' not in hdrs.get('content-security-policy', ''):
        issues.append({
            'category': 'Security',
            'problem': 'X-Frame-Options Header Missing',
            'why_it_matters': 'Without this header, malicious sites can embed this page in an iframe to perform clickjacking attacks.',
            'recommendation': 'Set the X-Frame-Options header to DENY or SAMEORIGIN.',
            'impact': 'Medium',
            'priority': 'High',
            'severity': 'Medium'
        })

    if 'x-content-type-options' not in hdrs:
        issues.append({
            'category': 'Security',
            'problem': 'X-Content-Type-Options Header Missing',
            'why_it_matters': 'Setting this header stops browsers from MIME-sniffing a response away from the declared content-type.',
            'recommendation': 'Add the X-Content-Type-Options: nosniff header.',
            'impact': 'Low',
            'priority': 'Medium',
            'severity': 'Low'
        })

    if 'referrer-policy' not in hdrs:
        issues.append({
            'category': 'Security',
            'problem': 'Referrer Policy Not Set',
            'why_it_matters': 'Without a referrer policy, sensitive URLs containing session details might leak to third-party domains.',
            'recommendation': 'Configure Referrer-Policy header to strict-origin-when-cross-origin.',
            'impact': 'Low',
            'priority': 'Low',
            'severity': 'Low'
        })

    sec_score = max(0.0, float(100 - len(issues) * 15))
    return sec_score, issues
