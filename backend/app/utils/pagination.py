from flask import request
from math import ceil


class PaginationHelper:
    def __init__(self, query, page=None, per_page=None, max_per_page=100):
        self.query = query
        self.page = page or int(request.args.get('page', 1))
        self.per_page = min(per_page or int(request.args.get('per_page', 20)), max_per_page)

        # Ensure positive values
        self.page = max(1, self.page)
        self.per_page = max(1, self.per_page)

    def paginate(self):
        # Get total count
        total = self.query.count()

        # Calculate pagination info
        total_pages = ceil(total / self.per_page) if total > 0 else 1

        # Ensure page doesn't exceed total pages
        self.page = min(self.page, total_pages)

        # Get items for current page
        offset = (self.page - 1) * self.per_page
        items = self.query.offset(offset).limit(self.per_page).all()

        # Calculate navigation info
        has_prev = self.page > 1
        has_next = self.page < total_pages
        prev_num = self.page - 1 if has_prev else None
        next_num = self.page + 1 if has_next else None

        return {
            'items': items,
            'pagination': {
                'page': self.page,
                'per_page': self.per_page,
                'total': total,
                'total_pages': total_pages,
                'has_prev': has_prev,
                'has_next': has_next,
                'prev_num': prev_num,
                'next_num': next_num
            }
        }


def paginate_query(query, page=None, per_page=None, max_per_page=100):
    """Convenience function for paginating queries"""
    helper = PaginationHelper(query, page, per_page, max_per_page)
    return helper.paginate()