from utils.helpers import format_name
from models.user import User
from services.api_service import ApiService


def main():
    service = ApiService()
    users = service.get_all_users()
    for user in users:
        print(format_name(user.name))


def create_app():
    return ApiService()


class AppConfig:
    DEBUG = False
    DATABASE_URL = "sqlite:///db.sqlite3"
