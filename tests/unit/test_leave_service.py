import importlib
import sys

import boto3
import pytest
from moto import mock_aws

TABLE_NAME = "hr-test-table"
MODULE_PATH = "api.services.leave_service"


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
        # Import only now (env set, table created) and drop any cached copy first.
        sys.modules.pop(MODULE_PATH, None)
        service = importlib.import_module(MODULE_PATH)
        yield service, table
        sys.modules.pop(MODULE_PATH, None)


def test_save_writes_employee_id_as_pk_and_start_date_as_sk(service_and_table):
    # Arrange
    service, table = service_and_table

    # Act
    service.save("emp1", "2026-07-10", {"endDate": "2026-07-12", "note": "trip"})

    # Assert
    stored = table.get_item(Key={"PK": "emp1", "SK": "2026-07-10"})["Item"]
    assert stored["PK"] == "emp1"
    assert stored["SK"] == "2026-07-10"


def test_save_stores_end_date_and_note(service_and_table):
    # Arrange
    service, table = service_and_table

    # Act
    returned = service.save("emp1", "2026-07-10", {"endDate": "2026-07-12", "note": "trip"})

    # Assert
    stored = table.get_item(Key={"PK": "emp1", "SK": "2026-07-10"})["Item"]
    assert stored["endDate"] == "2026-07-12"
    assert stored["note"] == "trip"
    assert returned == stored


def test_save_defaults_note_to_empty_string_when_omitted(service_and_table):
    # Arrange
    service, table = service_and_table

    # Act
    returned = service.save("emp1", "2026-07-10", {"endDate": "2026-07-12"})

    # Assert
    assert returned["note"] == ""
    stored = table.get_item(Key={"PK": "emp1", "SK": "2026-07-10"})["Item"]
    assert stored["note"] == ""


def test_save_same_employee_and_start_date_overwrites_instead_of_duplicating(
    service_and_table,
):
    # Arrange
    service, table = service_and_table
    service.save("emp1", "2026-07-10", {"endDate": "2026-07-12", "note": "first"})

    # Act
    service.save("emp1", "2026-07-10", {"endDate": "2026-07-15", "note": "second"})

    # Assert
    items = table.scan()["Items"]
    assert len(items) == 1
    assert items[0]["endDate"] == "2026-07-15"
    assert items[0]["note"] == "second"


def test_list_for_employee_without_month_returns_all_items_sorted_by_start_date(
    service_and_table,
):
    # Arrange
    service, _ = service_and_table
    # Saved out of order on purpose; another employee's leave must not appear.
    service.save("emp1", "2026-08-01", {"endDate": "2026-08-02"})
    service.save("emp1", "2026-06-15", {"endDate": "2026-06-16"})
    service.save("emp1", "2026-07-10", {"endDate": "2026-07-12"})
    service.save("emp2", "2026-07-01", {"endDate": "2026-07-02"})

    # Act
    result = service.list_for_employee("emp1", None)

    # Assert
    assert [item["startDate"] for item in result] == [
        "2026-06-15",
        "2026-07-10",
        "2026-08-01",
    ]
    assert all(item["employeeId"] == "emp1" for item in result)


def test_list_for_employee_with_month_returns_only_that_month_and_excludes_others(
    service_and_table,
):
    # Arrange
    service, _ = service_and_table
    service.save("emp1", "2026-07-03", {"endDate": "2026-07-04"})
    service.save("emp1", "2026-07-20", {"endDate": "2026-07-22"})
    service.save("emp1", "2026-08-05", {"endDate": "2026-08-06"})

    # Act
    result = service.list_for_employee("emp1", "2026-07")

    # Assert
    assert [item["startDate"] for item in result] == ["2026-07-03", "2026-07-20"]
    assert "2026-08-05" not in [item["startDate"] for item in result]


def test_list_for_employee_with_no_leave_returns_empty_list(service_and_table):
    # Arrange
    service, _ = service_and_table

    # Act
    result = service.list_for_employee("nobody", None)

    # Assert
    assert result == []
