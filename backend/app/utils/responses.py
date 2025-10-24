from flask import jsonify


def success_response(data=None, message="Success", status_code=200):
    """
    Standard success response format

    Parameters:
    - data: Any data to return to the client
    - message: Success message
    - status_code: HTTP status code

    Returns:
    - JSON response with standardized format
    """
    response = {
        "success": True,
        "message": message
    }
    if data is not None:
        response["data"] = data
    return jsonify(response), status_code


def error_response(message="An error occurred", status_code=400, errors=None):
    """
    Standard error response format

    Parameters:
    - message: Error message
    - status_code: HTTP status code
    - errors: Additional error details (optional)

    Returns:
    - JSON response with standardized format
    """
    response = {
        "success": False,
        "message": message
    }
    if errors:
        response["errors"] = errors
    return jsonify(response), status_code