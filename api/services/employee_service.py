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
                "Export it before running the API, e.g. "
                "`export TABLE_NAME=<dynamodb-table>`."
            )

        _table = boto3.resource("dynamodb").Table(table_name)

    return _table


def create(data: dict) -> dict:
    """Create an employee with a generated id."""
    return save(uuid.uuid4().hex[:8], data)


def list_all() -> list[dict]:
    """Return every employee."""
    response = _get_table().query(
        KeyConditionExpression=Key("PK").eq("USER")
    )
    return response.get("Items", [])


def get(employee_id: str) -> dict | None:
    """Return a single employee, or None if it does not exist."""
    response = _get_table().get_item(
        Key={
            "PK": "USER",
            "SK": employee_id,
        }
    )
    return response.get("Item")


def save(employee_id: str, data: dict) -> dict:
    """Create or replace an employee."""
    item = {
        "PK": "USER",
        "SK": employee_id,
        "GSI1PK": "USER_BY_DATE",
        "GSI1SK": data["startDate"],
        "employeeId": employee_id,
        "name": data["name"],
        "department": data["department"],
        "startDate": data["startDate"],
        "role": data.get("role", "employee"),
    }

    _get_table().put_item(Item=item)

    return item


def list_by_hire_date(hired_from: str, hired_to: str) -> list[dict]:
    """Return employees whose hire date falls within the requested range."""
    response = _get_table().query(
        IndexName="GSI1",
        KeyConditionExpression=(
            Key("GSI1PK").eq("USER_BY_DATE")
            & Key("GSI1SK").between(hired_from, hired_to)
        ),
    )

    return response.get("Items", [])