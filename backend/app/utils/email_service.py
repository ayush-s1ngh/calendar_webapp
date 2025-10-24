import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional
from ..utils.logger import logger

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('MAIL_PORT', '587'))
        self.use_tls = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
        self.username = os.getenv('MAIL_USERNAME')
        self.password = os.getenv('MAIL_PASSWORD')
        self.default_sender = os.getenv('MAIL_DEFAULT_SENDER', self.username)

    def send_email(self, 
                   to_emails: List[str], 
                   subject: str, 
                   body_text: str = None, 
                   body_html: str = None,
                   sender: str = None) -> bool:
        """
        Send email to recipients
        
        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body_text: Plain text body (optional)
            body_html: HTML body (optional)
            sender: Sender email (optional, uses default if not provided)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            if not self.username or not self.password:
                logger.error("Email credentials not configured")
                return False

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = sender or self.default_sender
            msg['To'] = ', '.join(to_emails)

            # Add text and HTML parts
            if body_text:
                part1 = MIMEText(body_text, 'plain')
                msg.attach(part1)

            if body_html:
                part2 = MIMEText(body_html, 'html')
                msg.attach(part2)

            # Connect to server and send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            
            if self.use_tls:
                server.starttls()
            
            server.login(self.username, self.password)
            text = msg.as_string()
            server.sendmail(sender or self.default_sender, to_emails, text)
            server.quit()

            logger.info(f"Email sent successfully to {', '.join(to_emails)}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False

    def send_verification_email(self, user_email: str, username: str, verification_token: str) -> bool:
        """Send email verification email"""
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        
        subject = "Verify Your Email Address - Calendar App"
        
        body_text = f"""
Hello {username},

Thank you for registering with Calendar App!

Please verify your email address by clicking the link below:
{verification_url}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

Best regards,
Calendar App Team
        """
        
        body_html = f"""
<html>
<head></head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Welcome to Calendar App!</h2>
        
        <p>Hello <strong>{username}</strong>,</p>
        
        <p>Thank you for registering with Calendar App! Please verify your email address to complete your registration.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" 
               style="background-color: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account with us, please ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
            Calendar App Team<br>
            This is an automated email, please do not reply.
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email([user_email], subject, body_text, body_html)

    def send_password_reset_email(self, user_email: str, username: str, reset_token: str) -> bool:
        """Send password reset email"""
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset Your Password - Calendar App"
        
        body_text = f"""
Hello {username},

You recently requested to reset your password for your Calendar App account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.

Best regards,
Calendar App Team
        """
        
        body_html = f"""
<html>
<head></head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Password Reset Request</h2>
        
        <p>Hello <strong>{username}</strong>,</p>
        
        <p>You recently requested to reset your password for your Calendar App account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" 
               style="background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
        </p>
        
        <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
            Calendar App Team<br>
            This is an automated email, please do not reply.
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email([user_email], subject, body_text, body_html)

    def send_reminder_notification(self, user_email: str, username: str, event_title: str, event_time: str) -> bool:
        """Send event reminder notification"""
        subject = f"Reminder: {event_title}"
        
        body_text = f"""
Hello {username},

This is a reminder for your upcoming event:

Event: {event_title}
Time: {event_time}

Don't forget to prepare for your event!

Best regards,
Calendar App Team
        """
        
        body_html = f"""
<html>
<head></head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Event Reminder</h2>
        
        <p>Hello <strong>{username}</strong>,</p>
        
        <p>This is a reminder for your upcoming event:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin: 0; color: #333;">{event_title}</h3>
            <p style="margin: 10px 0 0 0; color: #666;"><strong>Time:</strong> {event_time}</p>
        </div>
        
        <p>Don't forget to prepare for your event!</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
            Calendar App Team<br>
            This is an automated email, please do not reply.
        </p>
    </div>
</body>
</html>
        """
        
        return self.send_email([user_email], subject, body_text, body_html)

# Create global email service instance
email_service = EmailService()