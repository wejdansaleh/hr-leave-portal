import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from aws_lambda_powertools import Logger, Tracer

logger = Logger()
tracer = Tracer()

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

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
    logger.info("creating employee", department=data.get("department"))
    return save(uuid.uuid4().hex[:8], data)


#def list_all() -> list[dict]:
 #   """Return every employee."""
  #  response = _get_table().query(KeyConditionExpression=Key("PK").eq("USER"))
   # return response.get("Items", [])

#@tracer.capture_method
#def list_all() -> list[dict]:
 #   logger.info("listing all employees")
 #   response = table.query(KeyConditionExpression=Key("PK").eq("USER"))
 #   items = response["Items"]
  #  logger.info("listed all employees", count=len(items))
  #  return items


@tracer.capture_method
def list_by_hire_date(hired_from: str, hired_to: str) -> list[dict]:
    logger.info(
        "listing employees by hire date", hired_from=hired_from, hired_to=hired_to
    )
    response = table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq("USER_BY_DATE")
        & Key("GSI1SK").between(hired_from, hired_to),
    )
    items = response["Items"]
    logger.info("listed employees by hire date", count=len(items))
    return items
    
#def get(employee_id: str) -> dict | None:
 #   """Return a single employee, or None if it does not exist."""
 #  response = _get_table().get_item(Key={"PK": "USER", "SK": employee_id})
  #  return response.get("Item")

@tracer.capture_method
def get(employee_id: str) -> dict | None:
    logger.info("getting employee", employee_id=employee_id)
    response = table.get_item(Key={"PK": "USER", "SK": employee_id})
    item = response.get("Item")
    logger.info("get employee result", employee_id=employee_id, found=item is not None)
    return item


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
    table.put_item(Item=item)
    return item