import os
import requests
from typing import Dict, Optional
from urllib.parse import urlencode
from ..utils.logger import logger

class GoogleOAuthHandler:
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/google/callback')

    def get_authorization_url(self, state: str = None) -> str:
        """Generate Google OAuth authorization URL with proper encoding"""
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'access_type': 'offline',
            'prompt': 'consent'
        }
        if state:
            params['state'] = state
        return f"{base_url}?{urlencode(params)}"

    def exchange_code_for_tokens(self, code: str) -> Optional[Dict]:
        """Exchange authorization code for access tokens"""
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        try:
            response = requests.post(token_url, data=data, headers={'Accept': 'application/json'}, timeout=15)
            if response.status_code != 200:
                logger.error(f"Google token exchange failed: {response.status_code} {response.text}")
                response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"HTTP error exchanging code for tokens: {http_err}")
            return None
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
            return None

    def get_user_info(self, access_token: str) -> Optional[Dict]:
        """Get user information from Google using access token"""
        try:
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {'Authorization': f'Bearer {access_token}'}
            response = requests.get(user_info_url, headers=headers, timeout=15)
            if response.status_code != 200:
                logger.error(f"Google userinfo failed: {response.status_code} {response.text}")
                response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[Dict]:
        """Refresh access token using refresh token"""
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }
        try:
            response = requests.post(token_url, data=data, headers={'Accept': 'application/json'}, timeout=15)
            if response.status_code != 200:
                logger.error(f"Google token refresh failed: {response.status_code} {response.text}")
                response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"HTTP error refreshing token: {http_err}")
            return None
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            return None

# Global OAuth handler instance
google_oauth = GoogleOAuthHandler()