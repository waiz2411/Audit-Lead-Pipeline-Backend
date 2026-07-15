import csv
import sys
import os
from urllib.parse import urlparse

def extract_domains(csv_path):
    domains = set()
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)  # Skip header
            
            for row in reader:
                if not row:
                    continue
                # The first column typically contains the primary link URL
                url = row[0].strip()
                if url and (url.startswith("http://") or url.startswith("https://")):
                    parsed = urlparse(url)
                    domain = parsed.netloc
                    # Clean up port or www prefix if present
                    if ":" in domain:
                        domain = domain.split(":")[0]
                    if domain.startswith("www."):
                        domain = domain[4:]
                    if domain:
                        domains.add(domain)
    except Exception as e:
        print(f"Error reading file: {e}")
        
    return sorted(list(domains))

if __name__ == "__main__":
    # If a file path is provided as argument, use it; otherwise default to google.csv in same folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.join(current_dir, "google.csv")
    csv_file = sys.argv[1] if len(sys.argv) > 1 else default_csv
    
    if not os.path.exists(csv_file):
        print(f"Error: File '{csv_file}' does not exist.")
        sys.exit(1)
        
    print(f"Extracting domains from: {csv_file}")
    domains = extract_domains(csv_file)
    
    # Save the output to a text file in the same directory
    output_txt = os.path.join(current_dir, "extracted_domains.txt")
    with open(output_txt, "w", encoding="utf-8") as out:
        for domain in domains:
            out.write(domain + "\n")
            
    print(f"\nSuccessfully extracted {len(domains)} unique domains.")
    print(f"List saved to: {output_txt}\n")
    print("Domains:")
    for idx, domain in enumerate(domains, 1):
        print(f"{idx}. {domain}")
