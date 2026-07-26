import requests
from typing import Optional
import json
from ..core.config import settings

class LinkedInService:
    """Service for posting jobs to LinkedIn company pages."""
    
    BASE_URL = "https://api.linkedin.com/v2"
    
    def __init__(self):
        self.access_token = settings.LINKEDIN_ACCESS_TOKEN
        self.company_id = settings.LINKEDIN_COMPANY_ID
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
    
    def is_configured(self) -> bool:
        """Check if LinkedIn API is properly configured."""
        return bool(self.access_token and self.company_id)
    
    def post_job(
        self,
        title: str,
        description: str,
        location: str,
        job_url: str,
        salary_min: Optional[int] = None,
        salary_max: Optional[int] = None,
        employment_type: str = "CONTRACT",
    ) -> dict:
        """
        Post a job to LinkedIn company page.
        
        Args:
            title: Job title
            description: Job description
            location: Job location
            job_url: Link to apply/view job
            salary_min: Minimum salary
            salary_max: Maximum salary
            employment_type: Type of employment (CONTRACT, PERMANENT, etc.)
            
        Returns:
            Response from LinkedIn API
        """
        if not self.is_configured():
            raise ValueError("LinkedIn API not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_COMPANY_ID.")
        
        # Prepare job content
        job_content = f"""
{title}

{description}

📍 Location: {location}
🔗 Apply: {job_url}
"""
        
        if salary_min and salary_max:
            job_content += f"💰 Salary: ₹{salary_min:,} - ₹{salary_max:,}/month\n"
        
        # Create post with job details
        payload = {
            "author": f"urn:li:organization:{self.company_id}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": job_content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        try:
            response = requests.post(
                f"{self.BASE_URL}/ugcPosts",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return {
                "success": True,
                "message": "Job posted to LinkedIn successfully",
                "data": response.json()
            }
        except requests.exceptions.RequestException as e:
            response = getattr(e, "response", None)
            provider_error = response.text if response is not None else str(e)
            if response is not None and response.status_code == 403:
                provider_error = (
                    "This access token cannot publish to the configured company page. "
                    "Authorize the LinkedIn app with the w_organization_social scope using a "
                    "company-page administrator account, then replace LINKEDIN_ACCESS_TOKEN."
                )
            return {
                "success": False,
                "message": f"LinkedIn rejected the post: {provider_error}",
                "error": provider_error,
            }
    
    def get_post_url(self, post_id: str) -> str:
        """Convert post ID to LinkedIn post URL."""
        if not post_id:
            return ""
        return f"https://www.linkedin.com/feed/update/{post_id}"


linkedin_service = LinkedInService()
