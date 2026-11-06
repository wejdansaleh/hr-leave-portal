
import os

import boto3
from boto3.dynamodb.conditions import Key
from strands import tool

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


@tool
def save_leave(
    employee_id: str, start_date: str, end_date: str, note: str = ""
) -> dict:
    """Create or overwrite a leave request for an employee.

    Args:
        employee_id: The employee the leave belongs to.
        start_date: First day of leave, formatted YYYY-MM-DD.
        end_date: Last day of leave, formatted YYYY-MM-DD.
        note: Optional free-text note.
    """
    item = {
        "PK": employee_id,
        "SK": start_date,
        "employeeId": employee_id,
        "startDate": start_date,
        "endDate": end_date,
        "note": note,
    }
    table.put_item(Item=item)
    return item


@tool
def list_leave(employee_id: str, month: str | None = None) -> list[dict]:
    """List an employee's leave requests, optionally filtered to a month.

    Args:
        employee_id: The employee whose leave to list.
        month: Optional month prefix, formatted YYYY-MM. When given, only leave
            whose start date falls in that month is returned.
    """
    condition = Key("PK").eq(employee_id)
    if month:
        condition = condition & Key("SK").begins_with(month)

    response = table.query(KeyConditionExpression=condition)
    return response["Items"]
