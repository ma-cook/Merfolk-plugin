from models.user import User
from utils.helpers import validate_email


class ApiService:
    def __init__(self):
        self.users = []

    def get_all_users(self):
        return self.users

    async def create_user(self, name, email):
        if not validate_email(email):
            raise ValueError("Invalid email")
        user = User(len(self.users) + 1, name, email)
        self.users.append(user)
        return user

    def _build_query(self, filters):
        return filters
