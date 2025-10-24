from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY, YEARLY
import uuid

class RecurrenceGenerator:
    FREQUENCY_MAP = {
        'DAILY': DAILY,
        'WEEKLY': WEEKLY,
        'MONTHLY': MONTHLY,
        'YEARLY': YEARLY
    }
    
    WEEKDAY_MAP = {
        'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3,
        'FRI': 4, 'SAT': 5, 'SUN': 6
    }
    
    @staticmethod
    def generate_occurrences(event, recurrence_rule, start_date=None, end_date=None, max_occurrences=1000):
        """
        Generate event occurrences based on recurrence rule
        """
        if not recurrence_rule:
            return [event]
        
        # Set default date range if not provided
        if not start_date:
            start_date = event.start_datetime
        if not end_date:
            # Default to 2 years from start date
            end_date = start_date + relativedelta(years=2)
        
        # Build rrule parameters
        freq = RecurrenceGenerator.FREQUENCY_MAP.get(recurrence_rule.frequency)
        if not freq:
            return [event]
        
        rrule_params = {
            'freq': freq,
            'dtstart': event.start_datetime,
            'interval': recurrence_rule.interval or 1
        }
        
        # Add end condition
        if recurrence_rule.end_date:
            rrule_params['until'] = recurrence_rule.end_date
        elif recurrence_rule.occurrence_count:
            rrule_params['count'] = min(recurrence_rule.occurrence_count, max_occurrences)
        else:
            rrule_params['until'] = end_date
        
        # Add weekly specific parameters
        if recurrence_rule.frequency == 'WEEKLY' and recurrence_rule.days_of_week:
            weekdays = []
            for day in recurrence_rule.days_of_week.split(','):
                if day.strip() in RecurrenceGenerator.WEEKDAY_MAP:
                    weekdays.append(RecurrenceGenerator.WEEKDAY_MAP[day.strip()])
            if weekdays:
                rrule_params['byweekday'] = weekdays
        
        # Add monthly specific parameters
        if recurrence_rule.frequency == 'MONTHLY':
            if recurrence_rule.day_of_month:
                rrule_params['bymonthday'] = recurrence_rule.day_of_month
            elif recurrence_rule.week_of_month and recurrence_rule.day_of_week:
                weekday = RecurrenceGenerator.WEEKDAY_MAP.get(recurrence_rule.day_of_week)
                if weekday is not None:
                    # Convert week_of_month to rrule format
                    week_num = recurrence_rule.week_of_month
                    if week_num == 5:  # Last week of month
                        week_num = -1
                    rrule_params['byweekday'] = f"{weekday}({week_num})"
        
        try:
            # Generate occurrences
            rule = rrule(**rrule_params)
            occurrences = []
            
            for occurrence_start in rule:
                # Filter by date range
                if occurrence_start < start_date or occurrence_start > end_date:
                    continue
                
                # Calculate duration
                duration = None
                if event.end_datetime:
                    duration = event.end_datetime - event.start_datetime
                
                # Create occurrence data
                occurrence_end = occurrence_start + duration if duration else None
                
                occurrence = {
                    'id': f"{event.id}_{occurrence_start.strftime('%Y%m%d_%H%M%S')}",
                    'title': event.title,
                    'description': event.description,
                    'start_datetime': occurrence_start,
                    'end_datetime': occurrence_end,
                    'is_all_day': event.is_all_day,
                    'color': event.color,
                    'is_recurring': True,
                    'recurrence_id': event.recurrence_id,
                    'parent_event_id': event.id,
                    'created_at': event.created_at,
                    'updated_at': event.updated_at,
                    'categories': [cat.to_dict() for cat in event.categories] if hasattr(event, 'categories') else []
                }
                
                occurrences.append(occurrence)
                
                # Safety limit
                if len(occurrences) >= max_occurrences:
                    break
            
            return occurrences
            
        except Exception as e:
            print(f"Error generating recurrence: {e}")
            return [event]
    
    @staticmethod
    def generate_recurrence_id():
        """Generate a unique recurrence ID"""
        return str(uuid.uuid4())
    
    @staticmethod
    def validate_recurrence_rule(rule_data):
        """Validate recurrence rule data"""
        errors = []
        
        # Required fields
        if not rule_data.get('frequency'):
            errors.append("Frequency is required")
        elif rule_data['frequency'] not in RecurrenceGenerator.FREQUENCY_MAP:
            errors.append("Invalid frequency")
        
        # Interval validation
        interval = rule_data.get('interval', 1)
        if not isinstance(interval, int) or interval < 1:
            errors.append("Interval must be a positive integer")
        
        # Weekly validation
        if rule_data.get('frequency') == 'WEEKLY' and rule_data.get('days_of_week'):
            days = rule_data['days_of_week']
            if isinstance(days, str):
                days = days.split(',')
            
            for day in days:
                if day.strip() not in RecurrenceGenerator.WEEKDAY_MAP:
                    errors.append(f"Invalid day of week: {day}")
        
        # Monthly validation
        if rule_data.get('frequency') == 'MONTHLY':
            day_of_month = rule_data.get('day_of_month')
            week_of_month = rule_data.get('week_of_month')
            
            if day_of_month and (not isinstance(day_of_month, int) or day_of_month < 1 or day_of_month > 31):
                errors.append("Day of month must be between 1 and 31")
            
            if week_of_month and (not isinstance(week_of_month, int) or week_of_month < 1 or week_of_month > 5):
                errors.append("Week of month must be between 1 and 5")
        
        # End condition validation
        end_date = rule_data.get('end_date')
        occurrence_count = rule_data.get('occurrence_count')
        
        if end_date and occurrence_count:
            errors.append("Cannot specify both end_date and occurrence_count")
        
        if occurrence_count and (not isinstance(occurrence_count, int) or occurrence_count < 1):
            errors.append("Occurrence count must be a positive integer")
        
        return errors