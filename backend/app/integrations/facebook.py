import os
import requests
from typing import Optional
from ..core.config import get_settings

class FacebookService:
    """Service for posting jobs to Facebook pages."""
    
    BASE_URL = "https://graph.facebook.com/v19.0"
    
    @property
    def access_token(self) -> str:
        s = get_settings()
        return s.FACEBOOK_ACCESS_TOKEN or os.getenv("FACEBOOK_ACCESS_TOKEN", "")

    @property
    def page_id(self) -> str:
        s = get_settings()
        return s.FACEBOOK_PAGE_ID or os.getenv("FACEBOOK_PAGE_ID", "")
    
    def is_configured(self) -> bool:
        """Check if Facebook API is properly configured."""
        return bool(self.access_token and self.page_id)
    
    def post_job(
        self,
        title: str,
        description: str,
        location: str,
        job_url: str,
        salary_min: Optional[int] = None,
        salary_max: Optional[int] = None,
    ) -> dict:
        """
        Post a job to Facebook page.
        """
        if not self.is_configured():
            raise ValueError("Facebook API not configured. Set FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID.")
        
        from .banner import generate_hiring_banner

        # Prepare rich job caption
        job_content = f"🌟 WE ARE HIRING: {title.upper()}! 🌟\n\n"
        job_content += f"📍 Location: {location}\n"
        
        if salary_min and salary_max:
            job_content += f"💰 Salary: ₹{salary_min:,} - ₹{salary_max:,} / month\n"
        elif salary_min:
            job_content += f"💰 Salary: ₹{salary_min:,} / month\n"
            
        job_content += f"\n📋 Description:\n{description}\n\n"
        job_content += f"👉 Apply now directly via SmartHire:\n{job_url}"

        # Generate eye-catching poster image
        try:
            banner_bytes = generate_hiring_banner(
                title=title,
                location=location,
                salary_min=salary_min,
                salary_max=salary_max,
                apply_url=job_url,
            )
        except Exception:
            banner_bytes = None

        try:
            posted_photo = False
            if banner_bytes:
                try:
                    # Post photo with caption to Facebook Page Photos endpoint
                    response = requests.post(
                        f"{self.BASE_URL}/{self.page_id}/photos",
                        data={"caption": job_content, "access_token": self.access_token},
                        files={"source": ("hiring_banner.jpg", banner_bytes, "image/jpeg")},
                        timeout=30,
                    )
                    if response.status_code in (200, 201):
                        posted_photo = True
                except Exception:
                    posted_photo = False

            if not posted_photo:
                payload = {
                    "message": job_content,
                    "access_token": self.access_token
                }
                if job_url and not any(host in job_url.lower() for host in ["localhost", "127.0.0.1", "0.0.0.0"]):
                    payload["link"] = job_url

                response = requests.post(
                    f"{self.BASE_URL}/{self.page_id}/feed",
                    data=payload,
                    timeout=20
                )

            response.raise_for_status()
            data = response.json()
            
            return {
                "success": True,
                "message": "Job posted to Facebook successfully",
                "data": data
            }
        except requests.exceptions.RequestException as e:
            response_obj = getattr(e, "response", None)
            provider_error = response_obj.text if response_obj is not None else str(e)
            return {
                "success": False,
                "message": f"Facebook rejected the post: {provider_error}",
                "error": provider_error,
            }
    
    def get_post_url(self, post_id: str) -> str:
        """Convert post ID to Facebook post URL."""
        if not post_id:
            return ""
        # Facebook post IDs are often formatted as pageId_postId
        parts = post_id.split('_')
        if len(parts) == 2:
            return f"https://www.facebook.com/{parts[0]}/posts/{parts[1]}"
        return f"https://www.facebook.com/{post_id}"


facebook_service = FacebookService()
