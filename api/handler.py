import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from controllers import employee_controller, hr_request_controller, leave_controller

app = FastAPI(title="HR Leave Portal")

# Comma separated origins set by the CDK stack; unset (local uvicorn) allows all.
_allowed_origins = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employee_controller.router)
app.include_router(leave_controller.router)
app.include_router(hr_request_controller.router)

lambda_handler = Mangum(app)