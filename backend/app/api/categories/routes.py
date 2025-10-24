from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone

from ... import db
from . import categories_bp
from ...models import Category
from ...utils.responses import success_response, error_response
from ...utils.pagination import paginate_query
from ...utils.error_handler import handle_validation_errors, handle_database_errors, log_request_info
from ...utils.logger import logger


@categories_bp.route('', methods=['GET'])
@jwt_required()
@log_request_info
def get_categories():
    """
    Get all categories for the logged-in user with optional pagination

    Query Parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 50, max: 100)

    Returns:
    - Success response with list of categories and pagination info
    """
    try:
        # Build query for user's categories
        query = Category.query.filter_by(user_id=current_user.id).order_by(Category.name)

        # Check if pagination is requested
        page = request.args.get('page', type=int)
        per_page = request.args.get('per_page', type=int)

        if page or per_page:
            # Return paginated results
            result = paginate_query(query, page, per_page, max_per_page=100)
            categories_data = [category.to_dict() for category in result['items']]

            return success_response(
                data={
                    'categories': categories_data,
                    'pagination': result['pagination']
                }
            )
        else:
            # Return all categories (for dropdown lists, etc.)
            categories = query.all()
            categories_data = [category.to_dict() for category in categories]

            return success_response(data={'categories': categories_data})

    except Exception as e:
        logger.error(f"Error retrieving categories: {str(e)}")
        return error_response("An error occurred while retrieving categories", 500)


@categories_bp.route('/<int:category_id>', methods=['GET'])
@jwt_required()
@log_request_info
def get_category(category_id):
    """
    Get a specific category

    Parameters:
    - category_id: ID of the category

    Returns:
    - Success response with category details
    """
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return error_response("Category not found", 404)

        return success_response(data={'category': category.to_dict()})

    except Exception as e:
        logger.error(f"Error retrieving category {category_id}: {str(e)}")
        return error_response("An error occurred while retrieving the category", 500)


@categories_bp.route('', methods=['POST'])
@jwt_required()
@handle_validation_errors
@handle_database_errors
@log_request_info
def create_category():
    """
    Create a new category

    Request body:
    - name: Category name (required, unique per user)
    - color: Category color (optional, default: 'blue')
    - description: Category description (optional)

    Returns:
    - Success response with created category details
    """
    try:
        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Required fields
        name = data.get('name', '').strip()

        # Optional fields
        color = data.get('color', 'blue')
        description = data.get('description', '').strip() if data.get('description') else None

        # Validate required fields
        if not name:
            return error_response("Category name is required", 400)

        if len(name) > 64:
            return error_response("Category name must be 64 characters or less", 400)

        # Check if category name already exists for this user
        existing_category = Category.query.filter_by(
            user_id=current_user.id,
            name=name
        ).first()

        if existing_category:
            return error_response("A category with this name already exists", 409)

        # Create new category
        new_category = Category(
            user_id=current_user.id,
            name=name,
            color=color,
            description=description
        )

        # Save to database
        db.session.add(new_category)
        db.session.commit()

        logger.info(f"Category created: {new_category.id} ({name}) by user {current_user.username}")
        return success_response(
            data={'category': new_category.to_dict()},
            message="Category created successfully",
            status_code=201
        )

    except Exception as e:
        logger.error(f"Error creating category: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while creating the category", 500)


@categories_bp.route('/<int:category_id>', methods=['PUT'])
@jwt_required()
@handle_validation_errors
@handle_database_errors
@log_request_info
def update_category(category_id):
    """
    Update a category

    Parameters:
    - category_id: ID of the category

    Request body:
    - name: Category name (optional)
    - color: Category color (optional)
    - description: Category description (optional)

    Returns:
    - Success response with updated category details
    """
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return error_response("Category not found", 404)

        data = request.get_json()

        if not data:
            return error_response("Invalid request data", 400)

        # Process updates
        updates = {}

        # Update name if provided
        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return error_response("Category name cannot be empty", 400)

            if len(name) > 64:
                return error_response("Category name must be 64 characters or less", 400)

            # Check if name is being changed and if new name already exists
            if name != category.name:
                existing_category = Category.query.filter_by(
                    user_id=current_user.id,
                    name=name
                ).first()

                if existing_category:
                    return error_response("A category with this name already exists", 409)

            updates['name'] = name

        # Update color if provided
        if 'color' in data:
            updates['color'] = data['color']

        # Update description if provided
        if 'description' in data:
            description = data['description'].strip() if data['description'] else None
            updates['description'] = description

        # Apply updates
        for key, value in updates.items():
            setattr(category, key, value)

        category.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Category {category_id} updated by user {current_user.username}")
        return success_response(
            data={'category': category.to_dict()},
            message="Category updated successfully"
        )

    except Exception as e:
        logger.error(f"Error updating category {category_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while updating the category", 500)


@categories_bp.route('/<int:category_id>', methods=['DELETE'])
@jwt_required()
@handle_database_errors
@log_request_info
def delete_category(category_id):
    """
    Delete a category

    Parameters:
    - category_id: ID of the category

    Returns:
    - Success response
    """
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return error_response("Category not found", 404)

        # Check if category is being used by any events
        if category.events:
            return error_response(
                f"Cannot delete category '{category.name}' because it is assigned to {len(category.events)} event(s). "
                "Please remove the category from all events first.",
                400
            )

        category_name = category.name
        db.session.delete(category)
        db.session.commit()

        logger.info(f"Category {category_id} ({category_name}) deleted by user {current_user.username}")
        return success_response(message="Category deleted successfully")

    except Exception as e:
        logger.error(f"Error deleting category {category_id}: {str(e)}")
        db.session.rollback()
        return error_response("An error occurred while deleting the category", 500)


@categories_bp.route('/<int:category_id>/events', methods=['GET'])
@jwt_required()
@log_request_info
def get_category_events(category_id):
    """
    Get all events assigned to a specific category

    Parameters:
    - category_id: ID of the category

    Query Parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)

    Returns:
    - Success response with list of events
    """
    try:
        category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()

        if not category:
            return error_response("Category not found", 404)

        # Get events for this category with pagination
        from ...models import Event
        query = Event.query.join(Event.categories).filter(
            Category.id == category_id,
            Event.user_id == current_user.id
        ).order_by(Event.start_datetime.desc())

        result = paginate_query(query)

        events_data = []
        for event in result['items']:
            event_dict = event.to_dict()
            # Format datetime fields for JSON response
            event_dict['start_datetime'] = event.start_datetime.replace(tzinfo=timezone.utc).isoformat().replace(
                '+00:00', 'Z')
            if event.end_datetime:
                event_dict['end_datetime'] = event.end_datetime.replace(tzinfo=timezone.utc).isoformat().replace(
                    '+00:00', 'Z')
            event_dict['created_at'] = event.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            event_dict['updated_at'] = event.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            events_data.append(event_dict)

        return success_response(
            data={
                'category': category.to_dict(),
                'events': events_data,
                'pagination': result['pagination']
            }
        )

    except Exception as e:
        logger.error(f"Error retrieving events for category {category_id}: {str(e)}")
        return error_response("An error occurred while retrieving category events", 500)