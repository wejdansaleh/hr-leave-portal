
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from strands import tool

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


@tool
def create_employee(
    name: str, department: str, start_date: str, role: str = "employee"
) -> dict:
    """Create a new employee. Generates an id and stores the record.

    Args:
        name: Employee's full name.
        department: Department the employee belongs to.
        start_date: Hire date, formatted YYYY-MM-DD.
        role: Employee role. Defaults to "employee".
    """
    employee_id = uuid.uuid4().hex[:8]
    return save_employee(employee_id, name, department, start_date, role)


@tool
def get_employee(employee_id: str) -> dict | None:
    """Get a single employee by id. Returns None if not found.

    Args:
        employee_id: The employee's id.
    """
    response = table.get_item(Key={"PK": "USER", "SK": employee_id})
    return response.get("Item")


@tool
def list_employees() -> list[dict]:
    """List every employee."""
    response = table.query(KeyConditionExpression=Key("PK").eq("USER"))
    return response["Items"]


@tool
def list_employees_by_hire_date(hired_from: str, hired_to: str) -> list[dict]:
    """List employees hired within a date range, inclusive.

    Args:
        hired_from: Start of the hire-date range, formatted YYYY-MM-DD.
        hired_to: End of the hire-date range, formatted YYYY-MM-DD.
    """
    response = table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq("USER_BY_DATE")
        & Key("GSI1SK").between(hired_from, hired_to))
    return response["Items"]


@tool
def save_employee(
    employee_id: str,
    name: str,
    department: str,
    start_date: str,
    role: str = "employee") -> dict:
    """Create or overwrite an employee with a known id.

    Args:
        employee_id: The employee's id.
        name: Employee's full name.
        department: Department the employee belongs to.
        start_date: Hire date, formatted YYYY-MM-DD.
        role: Employee role. Defaults to "employee".
    """
    item = {
        "PK": "USER",
        "SK": employee_id,
        "GSI1PK": "USER_BY_DATE",
        "GSI1SK": start_date,
        "employeeId": employee_id,
        "name": name,
        "department": department,
        "startDate": start_date,
        "role": role,
    }
    table.put_item(Item=item)
    return item


@tool
def delete_employee(employee_id: str) -> dict:
    """Delete an employee by id.

    Args:
        employee_id: The employee's id.
    """
    table.delete_item(Key={"PK": "USER", "SK": employee_id})
    return {"deleted": employee_id}
