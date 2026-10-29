from datetime import date

from pydantic import BaseModel


class EmployeeIn(BaseModel):
    name: str
    department: str
    startDate: date
    role: str = "employee"

class LeaveIn(BaseModel):
    startDate: date
    endDate: date
    note: str = ""

class LeaveUpdate(BaseModel):
    endDate: date
    note: str = ""