import os
from aws_lambda_powertools import Logger, Tracer
from fastapi import FastAPI, Request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from controllers import employee_controller, hr_request_controller, leave_controller

ogger = Logger()
tracer = Tracer()

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

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("request received", method=request.method, path=request.url.path)
    response = await call_next(request)
    logger.info("request completed", status_code=response.status_code)
    return response

#lambda_handler = Mangum(app)
@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    return Mangum(app)(event, context)