import os
import requests
from typing import Optional
import json
from ..core.config import get_settings

def log_debug(msg: str):
    try:
        with open("/app/error_log.txt", "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


class LinkedInService:
    """Service for posting jobs to LinkedIn company pages."""
    
    BASE_URL = "https://api.linkedin.com/v2"
    
    @property
    def access_token(self) -> str:
        s = get_settings()
        return s.LINKEDIN_ACCESS_TOKEN or os.getenv("LINKEDIN_ACCESS_TOKEN", "")

    @property
    def company_id(self) -> str:
        s = get_settings()
        return s.LINKEDIN_COMPANY_ID or os.getenv("LINKEDIN_COMPANY_ID", "")
    
    @property
    def headers(self) -> dict:
        return {
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
        
        # Prepare rich job commentary
        job_content = f"🌟 WE ARE HIRING: {title.upper()}! 🌟\n\n"
        job_content += "🏢 Employer: LAYAM\n"
        job_content += f"📍 Location: {location}\n"
        
        if salary_min and salary_max:
            job_content += f"💰 Salary: ₹{salary_min:,} - ₹{salary_max:,} / month\n"
        elif salary_min:
            job_content += f"💰 Salary: ₹{salary_min:,} / month\n"
            
        job_content += f"💼 Employment Type: {employment_type}\n\n"
        job_content += f"📋 Description:\n{description}\n\n"
        job_content += f"👉 Apply now directly via SmartHire:\n{job_url}"
        
        # Construct author URN properly
        author_urn = self.company_id
        if not author_urn.startswith("urn:li:"):
            if author_urn.startswith("person:"):
                author_urn = f"urn:li:{author_urn}"
            elif author_urn.startswith("organization:"):
                author_urn = f"urn:li:{author_urn}"
            else:
                author_urn = f"urn:li:organization:{author_urn}"

        log_debug(f"post_job starting for title={title}")
        from .banner import generate_hiring_banner
        import traceback

        # Generate eye-catching poster image
        try:
            banner_bytes = generate_hiring_banner(
                title=title,
                location=location,
                salary_min=salary_min,
                salary_max=salary_max,
                employment_type=employment_type,
                apply_url=job_url,
            )
            log_debug(f"Banner generated, size={len(banner_bytes) if banner_bytes else 0}")
        except Exception as e:
            log_debug(f"Banner generation failed: {e}\n{traceback.format_exc()}")
            banner_bytes = None

        # Attempt to upload image asset if banner generated
        asset_urn = None
        if banner_bytes:
            try:
                reg_payload = {
                    "registerUploadRequest": {
                        "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                        "owner": author_urn,
                        "serviceRelationships": [
                            {"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}
                        ],
                    }
                }
                log_debug(f"Registering upload with payload: {reg_payload}")
                reg_resp = requests.post(
                    f"{self.BASE_URL}/assets?action=registerUpload",
                    json=reg_payload,
                    headers=self.headers,
                    timeout=10,
                )
                log_debug(f"Register upload status={reg_resp.status_code}, response={reg_resp.text}")
                if reg_resp.status_code == 200:
                    val = reg_resp.json().get("value", {})
                    upload_url = val.get("uploadMechanism", {}).get(
                        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {}
                    ).get("uploadUrl")
                    asset_urn = val.get("asset")

                    if upload_url and asset_urn:
                        log_debug(f"Uploading image to: {upload_url[:60]}...")
                        up_resp = requests.put(
                            upload_url,
                            data=banner_bytes,
                            headers={"Authorization": f"Bearer {self.access_token}"},
                            timeout=15,
                        )
                        log_debug(f"Upload image status={up_resp.status_code}")
                        if up_resp.status_code not in (200, 201):
                            log_debug(f"Upload image failed, status={up_resp.status_code}, body={up_resp.text}")
                            asset_urn = None
                else:
                    log_debug(f"Registration request failed with status={reg_resp.status_code}")
            except Exception as e:
                log_debug(f"Image upload registration failed: {e}\n{traceback.format_exc()}")
                asset_urn = None
        else:
            log_debug("Skipping image upload because banner_bytes is None")

        # Create post payload (IMAGE post if asset ready, else text post)
        share_content = {
            "shareCommentary": {"text": job_content},
            "shareMediaCategory": "IMAGE" if asset_urn else "NONE",
        }
        if asset_urn:
            share_content["media"] = [
                {
                    "status": "READY",
                    "description": {"text": title},
                    "media": asset_urn,
                    "title": {"text": f"WE ARE HIRING: {title}"},
                }
            ]

        payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": share_content
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
                "message": "Job posted to LinkedIn successfully with custom hiring banner",
                "data": response.json()
            }
        except requests.exceptions.RequestException as e:
            response = getattr(e, "response", None)
            raw_text = response.text if response is not None else str(e)
            
            error_msg = raw_text
            if response is not None and response.status_code == 403:
                if "/author" in raw_text or "ACCESS_DENIED" in raw_text:
                    error_msg = (
                        f"LinkedIn Permission Denied (403): Your LINKEDIN_ACCESS_TOKEN account does not have "
                        f"Admin posting rights for Company Page ID '{self.company_id}'. Please ensure: "
                        f"1) You logged in with a Super Admin account of Company Page {self.company_id} when generating the token. "
                        f"2) The scope 'w_organization_social' is enabled in your LinkedIn Developer Portal app."
                    )

            return {
                "success": False,
                "message": error_msg,
                "error": raw_text,
            }
    
    def get_post_url(self, post_id: str) -> str:
        """Convert post ID to LinkedIn post URL."""
        if not post_id:
            return ""
        return f"https://www.linkedin.com/feed/update/{post_id}"


linkedin_service = LinkedInService()
