"""
KYC Verification Service using AUA (Authentication User Agency) providers
Supports Aadhaar, PAN, and Bank Account verification
"""
import hashlib
import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class KYCVerificationService:
    """
    Service for verifying KYC documents through AUA providers.
    
    NOTE: This is a basic implementation structure. In production:
    - Integrate with actual AUA providers (UIDAI for Aadhaar, NSDL/UTI for PAN)
    - Use proper encryption and security protocols
    - Handle rate limiting and error retries
    - Store verification audit logs
    """

    def __init__(self):
        self.aadhaar_api_url = getattr(settings, "AADHAAR_AUA_URL", None)
        self.pan_api_url = getattr(settings, "PAN_VERIFICATION_URL", None)
        self.bank_api_url = getattr(settings, "BANK_VERIFICATION_URL", None)
        self.timeout = 30.0

    async def verify_aadhaar(
        self,
        aadhaar_number: str,
        name: str,
        dob: Optional[str] = None,
        mobile: Optional[str] = None,
    ) -> dict:
        """
        Verify Aadhaar card through UIDAI AUA provider
        
        Args:
            aadhaar_number: 12-digit Aadhaar number
            name: Full name as per Aadhaar
            dob: Date of birth (YYYY-MM-DD)
            mobile: Registered mobile number
        
        Returns:
            dict with verification result
        """
        # Validate Aadhaar number format
        if not re.match(r"^\d{12}$", aadhaar_number):
            return {
                "verified": False,
                "error": "Invalid Aadhaar number format",
                "provider": "aadhaar_aua",
            }

        # Mask Aadhaar for logging (show only last 4 digits)
        masked_aadhaar = "XXXX-XXXX-" + aadhaar_number[-4:]
        logger.info(f"Initiating Aadhaar verification for {masked_aadhaar}")

        # In production, call actual AUA API
        if self.aadhaar_api_url:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        self.aadhaar_api_url,
                        json={
                            "aadhaar": aadhaar_number,
                            "name": name,
                            "dob": dob,
                            "mobile": mobile,
                        },
                        headers={
                            "Authorization": f"Bearer {getattr(settings, 'AUA_API_KEY', '')}",
                            "Content-Type": "application/json",
                        },
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            "verified": result.get("status") == "verified",
                            "match_score": result.get("match_score", 0),
                            "provider": "aadhaar_aua",
                            "verified_at": datetime.utcnow().isoformat(),
                        }
                    else:
                        logger.error(f"Aadhaar verification failed: {response.status_code}")
                        return {
                            "verified": False,
                            "error": f"API returned status {response.status_code}",
                            "provider": "aadhaar_aua",
                        }
            except Exception as e:
                logger.exception(f"Aadhaar verification error: {e}")
                return {
                    "verified": False,
                    "error": str(e),
                    "provider": "aadhaar_aua",
                }
        else:
            # Mock verification for development
            logger.warning("AADHAAR_AUA_URL not configured. Using mock verification.")
            # Simple validation: name should be at least 3 characters
            is_valid = len(name) >= 3 and len(aadhaar_number) == 12
            return {
                "verified": is_valid,
                "match_score": 100 if is_valid else 0,
                "provider": "mock_aadhaar",
                "verified_at": datetime.utcnow().isoformat(),
                "note": "Mock verification - configure AADHAAR_AUA_URL for production",
            }

    async def verify_pan(self, pan_number: str, name: str, dob: Optional[str] = None) -> dict:
        """
        Verify PAN card through NSDL/UTI providers
        
        Args:
            pan_number: 10-character PAN number
            name: Full name as per PAN
            dob: Date of birth (YYYY-MM-DD)
        
        Returns:
            dict with verification result
        """
        # Validate PAN format: 5 letters, 4 digits, 1 letter
        if not re.match(r"^[A-Z]{5}\d{4}[A-Z]$", pan_number.upper()):
            return {
                "verified": False,
                "error": "Invalid PAN format",
                "provider": "pan_verification",
            }

        logger.info(f"Initiating PAN verification for {pan_number}")

        # In production, call actual PAN verification API
        if self.pan_api_url:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        self.pan_api_url,
                        json={
                            "pan": pan_number.upper(),
                            "name": name,
                            "dob": dob,
                        },
                        headers={
                            "Authorization": f"Bearer {getattr(settings, 'PAN_API_KEY', '')}",
                            "Content-Type": "application/json",
                        },
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            "verified": result.get("status") == "verified",
                            "name_match": result.get("name_match", False),
                            "pan_status": result.get("pan_status", "unknown"),
                            "provider": "pan_verification",
                            "verified_at": datetime.utcnow().isoformat(),
                        }
                    else:
                        return {
                            "verified": False,
                            "error": f"API returned status {response.status_code}",
                            "provider": "pan_verification",
                        }
            except Exception as e:
                logger.exception(f"PAN verification error: {e}")
                return {
                    "verified": False,
                    "error": str(e),
                    "provider": "pan_verification",
                }
        else:
            # Mock verification for development
            logger.warning("PAN_VERIFICATION_URL not configured. Using mock verification.")
            is_valid = re.match(r"^[A-Z]{5}\d{4}[A-Z]$", pan_number.upper()) is not None
            return {
                "verified": is_valid,
                "name_match": True if is_valid else False,
                "pan_status": "active" if is_valid else "invalid",
                "provider": "mock_pan",
                "verified_at": datetime.utcnow().isoformat(),
                "note": "Mock verification - configure PAN_VERIFICATION_URL for production",
            }

    async def verify_bank_account(
        self,
        account_number: str,
        ifsc_code: str,
        account_holder_name: str,
    ) -> dict:
        """
        Verify bank account through Penny Drop or similar service
        
        Args:
            account_number: Bank account number
            ifsc_code: IFSC code
            account_holder_name: Account holder name
        
        Returns:
            dict with verification result
        """
        # Validate IFSC format: 4 letters, 7 alphanumeric
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc_code.upper()):
            return {
                "verified": False,
                "error": "Invalid IFSC code format",
                "provider": "bank_verification",
            }

        logger.info(f"Initiating Bank Account verification for {ifsc_code}")

        # In production, call actual Bank verification API (Penny Drop)
        if self.bank_api_url:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        self.bank_api_url,
                        json={
                            "account_number": account_number,
                            "ifsc": ifsc_code.upper(),
                            "name": account_holder_name,
                        },
                        headers={
                            "Authorization": f"Bearer {getattr(settings, 'BANK_API_KEY', '')}",
                            "Content-Type": "application/json",
                        },
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return {
                            "verified": result.get("status") == "verified",
                            "account_exists": result.get("account_exists", False),
                            "name_match": result.get("name_match", False),
                            "bank_name": result.get("bank_name", ""),
                            "branch": result.get("branch", ""),
                            "provider": "bank_verification",
                            "verified_at": datetime.utcnow().isoformat(),
                        }
                    else:
                        return {
                            "verified": False,
                            "error": f"API returned status {response.status_code}",
                            "provider": "bank_verification",
                        }
            except Exception as e:
                logger.exception(f"Bank verification error: {e}")
                return {
                    "verified": False,
                    "error": str(e),
                    "provider": "bank_verification",
                }
        else:
            # Mock verification for development
            logger.warning("BANK_VERIFICATION_URL not configured. Using mock verification.")
            is_valid_ifsc = re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc_code.upper()) is not None
            return {
                "verified": is_valid_ifsc,
                "account_exists": is_valid_ifsc,
                "name_match": True if is_valid_ifsc else False,
                "bank_name": "Mock Bank" if is_valid_ifsc else "",
                "branch": "Mock Branch" if is_valid_ifsc else "",
                "provider": "mock_bank",
                "verified_at": datetime.utcnow().isoformat(),
                "note": "Mock verification - configure BANK_VERIFICATION_URL for production",
            }


# Singleton instance
kyc_service = KYCVerificationService()
