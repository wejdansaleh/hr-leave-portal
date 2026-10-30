import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key

_table = None


def _get_table():
    """Resolve the DynamoDB table lazily so a missing TABLE_NAME does not crash import."""
    global _table
    if _table is None:
        table_name = os.environ.get("TABLE_NAME")
        if not table_name:
            raise RuntimeError(
                "TABLE_NAME environment variable is not set. "
                "Export it before running the API, e.g. `export TABLE_NAME=<dynamodb-table>`."
            )
        _table = boto3.resource("dynamodb").Table(table_name)
    return _table


def create(data: dict) -> dict:
    """Create an employee with a generated id."""
    return save(uuid.uuid4().hex[:8], data)


def list_all() -> list[dict]:
    """Return every employee."""
    response = _get_table().query(KeyConditionExpression=Key("PK").eq("USER"))
    return response.get("Items", [])


def get(employee_id: str) -> dict | None:
    """Return a single employee, or None if it does not exist."""
    response = _get_table().get_item(Key={"PK": "USER", "SK": employee_id})
    return response.get("Item")


def save(employee_id: str, data: dict) -> dict:
    """Create or replace an employee."""
    item = {
        "PK": "USER",
        "SK": employee_id,
        "employeeId": employee_id,
        "name": data["name"],
        "department": data["department"],
        "startDate": data["startDate"],
        "role": data.get("role", "employee"),
    }
    _get_table().put_item(Item=item)
    return item