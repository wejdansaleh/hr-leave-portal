from fastapi import FastAPI
from mangum import Mangum

from controllers import employee_controller

app = FastAPI(title="HR Leave Portal")

app.include_router(employee_controller.router)

# API Gateway -> Lambda entrypoint. CDK references this as "handler.lambda_handler".
lambda_handler = Mangum(app)