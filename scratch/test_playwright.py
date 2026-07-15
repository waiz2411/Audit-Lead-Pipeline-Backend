import asyncio
import sys
from playwright.async_api import async_playwright

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def main():
    print("Starting playwright...")
    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        print("Creating context...")
        context = await browser.new_context()
        print("Creating page...")
        page = await context.new_page()
        print("Navigating...")
        await page.goto("https://example.com")
        title = await page.title()
        print(f"Title: {title}")
        await browser.close()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
