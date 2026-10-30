from fastapi import APIRouter
from fastapi import APIRouter, Query
from models import LeaveIn
from services import leave_service
from datetime import date
from models import LeaveIn, LeaveUpdate


router = APIRouter(tags=["leave"])


@router.post("/employees/{employee_id}/leave", status_code=201)
def create_leave(employee_id: str, payload: LeaveIn):
    body = payload.model_dump(mode="json")
    return leave_service.save(employee_id, body["startDate"], body)


@router.get("/employees/{employee_id}/leave")
def list_leave(
    employee_id: str, month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$")
):
    return {"leave": leave_service.list_for_employee(employee_id, month)}

@router.put("/employees/{employee_id}/leave/{start_date}")
def save_leave(employee_id: str, start_date: date, payload: LeaveUpdate):
    return leave_service.save(
        employee_id, start_date.isoformat(), payload.model_dump(mode="json")
    )