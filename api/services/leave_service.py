import os

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


def save(employee_id: str, start_date: str, data: dict) -> dict:
    item = {
        "PK": employee_id,
        "SK": start_date,
        "employeeId": employee_id,
        "startDate": start_date,
        "endDate": data["endDate"],
        "note": data.get("note", ""),
    }
    _get_table().put_item(Item=item)
    return item


def list_for_employee(employee_id: str, month: str | None) -> list[dict]:
    condition = Key("PK").eq(employee_id)
    if month:
        condition = condition & Key("SK").begins_with(month)

    response = _get_table().query(KeyConditionExpression=condition)
    return response["Items"]