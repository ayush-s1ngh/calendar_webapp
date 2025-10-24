import logging
import os
import sys
from logging.handlers import RotatingFileHandler

# Ensure logs directory exists
if not os.path.exists('logs'):
    os.makedirs('logs')

# Configure logger
logger = logging.getLogger('calendar_app')
logger.setLevel(logging.INFO)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_format)

# File handler
file_handler = RotatingFileHandler('logs/app.log', maxBytes=10*1024*1024, backupCount=5)
file_handler.setLevel(logging.INFO)
file_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_format)

# Add handlers to logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)