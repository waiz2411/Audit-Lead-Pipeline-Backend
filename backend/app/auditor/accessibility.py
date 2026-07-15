from bs4 import BeautifulSoup

def run_accessibility_audit(html_content: str, axe_violations: list = None) -> tuple[float, list]:
    issues = []
    soup = BeautifulSoup(html_content, 'lxml') if html_content else BeautifulSoup('', 'lxml')
    
    # Process axe violations if provided, otherwise fallback to heuristics
    if axe_violations:
        for v in axe_violations:
            issues.append({
                'category': 'Accessibility',
                'problem': v.get('help', 'Accessibility issue found'),
                'why_it_matters': v.get('description', 'Failing accessibility checks hurts disabled users and search indexing.'),
                'recommendation': f"Fix {v.get('id', 'rule')}: inspect elements like {', '.join([n.get('target', [''])[0] for n in v.get('nodes', [])[:3]])}.",
                'impact': 'High' if v.get('impact') in ['critical', 'serious'] else 'Medium',
                'priority': 'High' if v.get('impact') in ['critical', 'serious'] else 'Medium',
                'severity': 'High' if v.get('impact') in ['critical', 'serious'] else 'Medium'
            })
    else:
        # Heuristics
        # Check viewport for user scalability
        meta_viewport = soup.find('meta', attrs={'name': 'viewport'})
        if meta_viewport:
            content = meta_viewport.get('content', '')
            if 'user-scalable=no' in content or 'maximum-scale=1' in content:
                issues.append({
                    'category': 'Accessibility',
                    'problem': 'User Scalability Disabled',
                    'why_it_matters': 'Disabling zoom prevents visually impaired users from magnifying page text.',
                    'recommendation': 'Remove user-scalable=no and maximum-scale attributes from the viewport meta tag.',
                    'impact': 'High',
                    'priority': 'Medium',
                    'severity': 'Medium'
                })
        
        # Heading order
        headings = [h.name for h in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])]
        headings_nums = [int(h[1]) for h in headings]
        # check if skipping levels
        skips = False
        for i in range(len(headings_nums)-1):
            if headings_nums[i+1] > headings_nums[i] + 1:
                skips = True
                break
        if skips:
            issues.append({
                'category': 'Accessibility',
                'problem': 'Incorrect Heading Order hierarchy',
                'why_it_matters': 'Screen readers rely on sequential heading structure to navigate page hierarchy.',
                'recommendation': 'Refactor headings so they follow strict sequential order (e.g. H2 followed by H3, not H4 directly).',
                'impact': 'Medium',
                'priority': 'Low',
                'severity': 'Medium'
            })

        # Check landmarks (header, nav, main, footer)
        has_nav = soup.find('nav') is not None
        has_main = soup.find('main') is not None or soup.find(id='main') is not None or soup.find(class_='main') is not None
        if not has_nav or not has_main:
            issues.append({
                'category': 'Accessibility',
                'problem': 'Missing Landmark Elements',
                'why_it_matters': 'Landmark elements like <nav> and <main> allow assistive technologies to easily navigate structure.',
                'recommendation': 'Wrap primary navigation in <nav> and main content area in <main>.',
                'impact': 'Medium',
                'priority': 'Medium',
                'severity': 'Low'
            })

        # ARIA attributes checking on interactive components
        buttons = soup.find_all(['button', 'a'])
        missing_names = 0
        for b in buttons:
            if not b.get_text().strip() and not b.get('aria-label') and not b.get('title'):
                missing_names += 1
        if missing_names > 0:
            issues.append({
                'category': 'Accessibility',
                'problem': f'{missing_names} Buttons or Links missing accessible labels',
                'why_it_matters': 'Screen reader users cannot understand the purpose of buttons or links that contain only icons or empty labels.',
                'recommendation': 'Provide descriptive text, titles, or aria-label attributes to all empty/icon-only links and buttons.',
                'impact': 'High',
                'priority': 'High',
                'severity': 'High'
            })

    a11y_score = max(0.0, float(100 - len(issues) * 15))
    return a11y_score, issues
