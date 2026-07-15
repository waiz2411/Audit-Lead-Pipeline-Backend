def run_performance_audit(page_metrics: dict) -> tuple[float, list]:
    issues = []
    
    # page_metrics: {fcp, lcp, cls, inp, speed_index, tbt, dom_size, unused_css, unused_js, render_blocking}
    fcp = page_metrics.get('fcp', 1500)
    lcp = page_metrics.get('lcp', 2800)
    cls = page_metrics.get('cls', 0.15)
    tbt = page_metrics.get('tbt', 350)
    dom_size = page_metrics.get('dom_size', 900)
    unused_js = page_metrics.get('unused_js', True)
    unused_css = page_metrics.get('unused_css', True)
    render_blocking = page_metrics.get('render_blocking', 3)
    
    if lcp > 2500:
        issues.append({
            'category': 'Performance',
            'problem': f'Largest Contentful Paint (LCP) is high ({lcp/1000:.2f}s)',
            'why_it_matters': 'LCP measures when the main content of a page has likely loaded. A high LCP makes users feel the site is slow.',
            'recommendation': 'Optimize hero images, compress media assets, and remove render-blocking resources.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
        
    if cls > 0.1:
        issues.append({
            'category': 'Performance',
            'problem': f'Cumulative Layout Shift (CLS) is too high ({cls:.3f})',
            'why_it_matters': 'CLS measures visual stability. Content shifting dynamically causes accidental clicks and user frustration.',
            'recommendation': 'Ensure all image and video elements have explicit width and height attributes.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })
        
    if tbt > 200:
        issues.append({
            'category': 'Performance',
            'problem': f'Total Blocking Time (TBT) is elevated ({tbt}ms)',
            'why_it_matters': 'TBT measures the total amount of time between FCP and Time to Interactive where the main thread is blocked.',
            'recommendation': 'Reduce third-party scripts, split large JS bundles, and optimize code execution.',
            'impact': 'High',
            'priority': 'High',
            'severity': 'High'
        })
        
    if dom_size > 800:
        issues.append({
            'category': 'Performance',
            'problem': f'Excessive DOM Size ({dom_size} nodes)',
            'why_it_matters': 'A large DOM tree increases memory usage, causes longer style calculations, and slows down page rendering.',
            'recommendation': 'Refactor the template structure to remove unnecessary wrapper div/elements.',
            'impact': 'Low',
            'priority': 'Low',
            'severity': 'Medium'
        })

    if render_blocking > 2:
        issues.append({
            'category': 'Performance',
            'problem': f'Multiple Render-Blocking Resources ({render_blocking})',
            'why_it_matters': 'CSS and JS loading in the head block page painting until downloaded, delaying the page load.',
            'recommendation': 'Inline critical styles, defer non-critical JS/CSS, or load them asynchronously.',
            'impact': 'Medium',
            'priority': 'High',
            'severity': 'High'
        })

    if unused_js:
        issues.append({
            'category': 'Performance',
            'problem': 'Unused Javascript Found',
            'why_it_matters': 'Downloading and compiling JavaScript files that are not executed consumes bytes and blocks main thread parsing.',
            'recommendation': 'Remove unused code, employ tree-shaking, and lazy-load bundles.',
            'impact': 'Medium',
            'priority': 'Medium',
            'severity': 'Medium'
        })

    if unused_css:
        issues.append({
            'category': 'Performance',
            'problem': 'Unused CSS Rules Found',
            'why_it_matters': 'Extra CSS rules slow down style resolution and increase the size of stylesheets unnecessarily.',
            'recommendation': 'Purge unused CSS styles from stylesheets.',
            'impact': 'Low',
            'priority': 'Medium',
            'severity': 'Low'
        })

    perf_score = max(0.0, float(100 - len(issues) * 12))
    return perf_score, issues
