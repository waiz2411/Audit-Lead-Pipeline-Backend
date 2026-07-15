from bs4 import BeautifulSoup

def run_design_audit(html_content: str, responsive_issues: list = None) -> tuple[float, list]:
    issues = []
    soup = BeautifulSoup(html_content, 'lxml') if html_content else BeautifulSoup('', 'lxml')
    
    # 1. Clear hero section check
    # Check for sections with class containing hero, banner, or id hero
    hero = soup.find(lambda tag: tag.name in ['section', 'div', 'header'] and 
                    (any(x in str(tag.get('class', '')).lower() for x in ['hero', 'banner', 'jumbotron', 'showcase']) or 
                     'hero' in str(tag.get('id', '')).lower()))
    if not hero:
        issues.append({
            'category': 'Design',
            'problem': 'Missing Clear Hero Section',
            'why_it_matters': 'A hero section captures attention instantly, communicating value proposition clearly to new visitors.',
            'recommendation': 'Design a prominent above-the-fold hero section containing a header, summary, and call to action.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
        
    # 2. Call to Action (CTA) visibility
    # Check if there are buttons or anchor tags acting as buttons in the hero section or top part
    ctas = soup.find_all(lambda tag: tag.name in ['a', 'button'] and 
                         (any(x in str(tag.get('class', '')).lower() for x in ['btn', 'button', 'cta', 'primary']) or
                          any(x in tag.get_text().lower() for x in ['sign up', 'get started', 'contact', 'buy', 'register', 'try free', 'demo'])))
    if not ctas:
        issues.append({
            'category': 'Design',
            'problem': 'Weak Call-to-Action (CTA) Visibility',
            'why_it_matters': 'Without clear CTAs, visitors are less likely to convert or take the desired next action.',
            'recommendation': 'Add a high-contrast primary CTA button in the navigation header and hero section.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })

    # 3. Modern UI Heuristics (Cards, Sections, Icons)
    cards = soup.find_all(lambda tag: any(x in str(tag.get('class', '')).lower() for x in ['card', 'grid-item', 'feature', 'tile']))
    if len(cards) < 2:
        issues.append({
            'category': 'Design',
            'problem': 'Traditional Layout Pattern',
            'why_it_matters': 'Modern layouts employ card structures, CSS grids, and modern UI sections to group content cleanly.',
            'recommendation': 'Adopt a modern card-based layout to showcase features, services, or testimonials.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })

    # 4. Spacing and Structure Heuristic
    # If the layout uses old patterns like tables for layout, or deprecated elements like <center>, <font>, etc.
    deprecated = soup.find_all(['center', 'font', 'marquee', 'frame', 'frameset'])
    if deprecated:
        issues.append({
            'category': 'Design',
            'problem': 'Outdated HTML Tags Used for Styling',
            'why_it_matters': 'Tags like <center> or <font> have been deprecated for decades. They inhibit responsive design and violate web standards.',
            'recommendation': 'Replace all deprecated layout tags with modern CSS Flexbox/Grid and utility typography.',
            'impact': 'Medium',
            'priority': 'High',
            'severity': 'High'
        })

    # 5. Spacing Consistency
    # If we have a lot of br tags instead of margin/padding
    brs = soup.find_all('br')
    if len(brs) > 10:
        issues.append({
            'category': 'Design',
            'problem': 'Excessive Line Breaks for Spacing',
            'why_it_matters': 'Using <br> tags for vertical spacing causes brittle, inconsistent layout flow across screen sizes.',
            'recommendation': 'Replace multiple <br> tags with margin or padding rules in CSS.',
            'impact': 'Low',
            'priority': 'Low',
            'severity': 'Low'
        })

    # 6. Typography Heuristic (Lack of structured headings, plain fonts)
    # Check text styling from custom fonts (Google fonts, Adobe fonts etc.)
    font_links = soup.find_all('link', href=lambda href: href and any(x in href for x in ['fonts.googleapis.com', 'use.typekit.net', 'fast.fonts.net']))
    if not font_links:
        issues.append({
            'category': 'Design',
            'problem': 'System Default Fonts Only',
            'why_it_matters': 'Polished typography establishes brand identity. Plain system default fonts (e.g. Times New Roman) look unstyled and outdated.',
            'recommendation': 'Integrate a modern font family like Inter, Montserrat, or Roboto via Google Fonts.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Low'
        })

    # 7. Stylesheet detection
    css_links = soup.find_all('link', rel='stylesheet')
    style_tags = soup.find_all('style')
    if not css_links and not style_tags:
        issues.append({
            'category': 'Design',
            'problem': 'No External or Internal Stylesheets Found',
            'why_it_matters': 'A website without styles will render as plain text, looking completely unstyled and broken.',
            'recommendation': 'Include a stylesheet link in the head section of your page or integrate a CSS library.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })

    # 8. Visual / Media assets checking
    imgs = soup.find_all('img')
    vids = soup.find_all(['video', 'iframe'])
    if not imgs and not vids:
        issues.append({
            'category': 'Design',
            'problem': 'No Visual or Media Assets Found',
            'why_it_matters': 'Modern engaging websites utilize images, illustrations, or videos to convey information and build trust.',
            'recommendation': 'Add relevant high-quality images, illustrations, or videos to make the site visually appealing.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Low'
        })

    # Integrate responsive issues if any
    if responsive_issues:
        for r_issue in responsive_issues:
            issues.append({
                'category': 'Responsive',
                'problem': r_issue.get('problem'),
                'why_it_matters': r_issue.get('why_it_matters'),
                'recommendation': r_issue.get('recommendation'),
                'impact': r_issue.get('impact', 'Medium'),
                'priority': r_issue.get('priority', 'Medium'),
                'severity': r_issue.get('severity', 'Medium')
            })

    design_score = max(0.0, float(100 - len(issues) * 12))
    return design_score, issues
