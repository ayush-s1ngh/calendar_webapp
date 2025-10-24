from functools import wraps
from flask import request, g
from datetime import datetime, timedelta
from collections import defaultdict
import time
from ..utils.responses import error_response
from ..utils.logger import logger

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked_ips = defaultdict(datetime)

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> bool:
        """
        Check if a key (IP, user_id, etc.) is rate limited
        
        Args:
            key: Unique identifier for the requester
            limit: Maximum number of requests allowed
            window_seconds: Time window in seconds
            
        Returns:
            bool: True if rate limited, False otherwise
        """
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        self.requests[key] = [req_time for req_time in self.requests[key] if req_time > window_start]
        
        # Check if limit exceeded
        if len(self.requests[key]) >= limit:
            return True
        
        # Add current request
        self.requests[key].append(now)
        return False

    def block_ip(self, ip: str, duration_minutes: int = 60):
        """Block an IP address for a specified duration"""
        self.blocked_ips[ip] = datetime.utcnow() + timedelta(minutes=duration_minutes)
        logger.warning(f"IP {ip} blocked for {duration_minutes} minutes")

    def is_ip_blocked(self, ip: str) -> bool:
        """Check if an IP is currently blocked"""
        if ip in self.blocked_ips:
            if datetime.utcnow() < self.blocked_ips[ip]:
                return True
            else:
                del self.blocked_ips[ip]
        return False

# Global rate limiter instance
rate_limiter = RateLimiter()

def rate_limit(limit: int = 60, window: int = 60, per: str = 'ip'):
    """
    Rate limiting decorator
    
    Args:
        limit: Number of requests allowed
        window: Time window in seconds
        per: What to rate limit by ('ip', 'user')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Determine rate limit key
            if per == 'ip':
                key = f"ip:{request.remote_addr}"
            elif per == 'user':
                from flask_jwt_extended import current_user, jwt_required
                try:
                    user_id = getattr(current_user, 'id', None) if current_user else None
                    key = f"user:{user_id}" if user_id else f"ip:{request.remote_addr}"
                except:
                    key = f"ip:{request.remote_addr}"
            else:
                key = f"ip:{request.remote_addr}"

            # Check if IP is blocked
            if rate_limiter.is_ip_blocked(request.remote_addr):
                logger.warning(f"Blocked IP {request.remote_addr} attempted access to {request.endpoint}")
                return error_response("Your IP address has been temporarily blocked", 429)

            # Check rate limit
            if rate_limiter.is_rate_limited(key, limit, window):
                logger.warning(f"Rate limit exceeded for {key} on {request.endpoint}")
                return error_response("Rate limit exceeded. Please try again later.", 429)

            return f(*args, **kwargs)
        return decorated_function
    return decorator