import importlib
import sys

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = "hr-test-table"
MODULE_PATH = "api.services.employee_service"


def _create_table():
    """Create the mocked table with the same schema as HrTable in backend_stack.py."""
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    return dynamodb.create_table(
        TableName=TABLE_NAME,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )


@pytest.fixture
def service_and_table(monkeypatch):
    """Set env, start moto, create the table, then import a fresh service module."""
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("POWERTOOLS_TRACE_DISABLED", "true")

    with mock_aws():
        table = _create_table()
        # The service reads TABLE_NAME and builds its table at import time, so import
        # only now (env set, table created) and drop any cached copy first.
        sys.modules.pop(MODULE_PATH, None)
        service = importlib.import_module(MODULE_PATH)
        yield service, table
        sys.modules.pop(MODULE_PATH, None)


@pytest.fixture
def employee_data():
    return {
        "name": "Alice Smith",
        "department": "Engineering",
        "startDate": "2024-03-01",
        "role": "manager",
    }


def test_create_generates_8_char_id(service_and_table, employee_data):
    # Arrange
    service, _ = service_and_table

    # Act
    result = service.create(employee_data)

    # Assert
    assert len(result["SK"]) == 8


def test_create_writes_user_pk_and_id_as_sk(service_and_table, employee_data):
    # Arrange
    service, table = service_and_table

    # Act
    result = service.create(employee_data)

    # Assert
    stored = table.get_item(Key={"PK": "USER", "SK": result["SK"]}).get("Item")
    assert stored is not None
    assert stored["PK"] == "USER"
    assert stored["SK"] == result["SK"]


def test_create_returns_employee_id_equal_to_sk(service_and_table, employee_data):
    # Arrange
    service, _ = service_and_table

    # Act
    result = service.create(employee_data)

    # Assert
    assert result["employeeId"] == result["SK"]


def test_create_twice_produces_different_ids(service_and_table, employee_data):
    # Arrange
    service, table = service_and_table

    # Act
    first = service.create(employee_data)
    second = service.create(employee_data)

    # Assert
    assert first["employeeId"] != second["employeeId"]
    assert table.scan()["Count"] == 2


def test_save_writes_expected_item(service_and_table, employee_data):
    # Arrange
    service, table = service_and_table

    # Act
    returned = service.save("emp00001", employee_data)

    # Assert
    expected = {
        "PK": "USER",
        "SK": "emp00001",
        "employeeId": "emp00001",
        "name": "Alice Smith",
        "department": "Engineering",
        "startDate": "2024-03-01",
        "role": "manager",
    }
    assert returned == expected
    assert table.get_item(Key={"PK": "USER", "SK": "emp00001"})["Item"] == expected


def test_save_defaults_role_to_employee_when_omitted(service_and_table, employee_data):
    # Arrange
    service, table = service_and_table
    del employee_data["role"]

    # Act
    returned = service.save("emp00002", employee_data)

    # Assert
    assert returned["role"] == "employee"
    stored = table.get_item(Key={"PK": "USER", "SK": "emp00002"})["Item"]
    assert stored["role"] == "employee"
