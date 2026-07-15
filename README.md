# Audit Lead Pipeline - Backend

FastAPI backend with background workers for website SEO, performance, accessibility, security, and responsive audits.

## Running the Server
1. Tell Python where your library packages are:
   ```powershell
   $env:PYTHONPATH="C:\Users\waizt\AppData\Roaming\Python\Python313\site-packages"
   ```
2. Start the backend:
   ```powershell
   C:\laragon\bin\python\python-3.13\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
